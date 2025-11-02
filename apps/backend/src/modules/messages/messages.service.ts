import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { Message } from './message.entity';
import { User } from '../users/user.entity';
import { SendMessageDto } from './dto';
import { RealtimeGateway } from '../../realtime/realtime.gateway';

interface ContactView {
  id: string;
  email: string;
  name?: string;
  lastAt?: string;
  unreadCount: number;
}

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Message) private readonly messages: Repository<Message>,
    @InjectRepository(User) private readonly users: Repository<User>,
    private readonly realtime: RealtimeGateway,
  ) {}

  async listContacts(userId: string) {
    const [people, history] = await Promise.all([
      this.users.find({ where: { id: Not(userId) } }),
      this.messages
        .createQueryBuilder('message')
        .leftJoinAndSelect('message.sender', 'sender')
        .leftJoinAndSelect('message.recipient', 'recipient')
        .where('sender.id = :userId OR recipient.id = :userId', { userId })
        .orderBy('message.createdAt', 'DESC')
        .getMany(),
    ]);

    const contactMap = new Map<string, ContactView>();
    for (const person of people) {
      contactMap.set(person.id, {
        id: person.id,
        email: person.email,
        name: person.name,
        unreadCount: 0,
      });
    }

    for (const message of history) {
      const contact = message.sender.id === userId ? message.recipient : message.sender;
      const entry = contactMap.get(contact.id) ?? {
        id: contact.id,
        email: contact.email,
        name: contact.name,
        unreadCount: 0,
      };
      if (!entry.lastAt || new Date(entry.lastAt) < message.createdAt) {
        entry.lastAt = message.createdAt.toISOString();
      }
      if (message.recipient.id === userId && !message.read) {
        entry.unreadCount += 1;
      }
      contactMap.set(contact.id, entry);
    }

    return Array.from(contactMap.values()).sort((a, b) => {
      if (!a.lastAt && !b.lastAt) return a.email.localeCompare(b.email);
      if (!a.lastAt) return 1;
      if (!b.lastAt) return -1;
      return new Date(b.lastAt).getTime() - new Date(a.lastAt).getTime();
    });
  }

  async getThread(userId: string, contactId: string) {
    if (userId === contactId) {
      throw new BadRequestException('Cannot fetch conversation with yourself');
    }
    const contact = await this.users.findOne({ where: { id: contactId } });
    if (!contact) {
      throw new NotFoundException('Contact not found');
    }

    await this.messages
      .createQueryBuilder()
      .update(Message)
      .set({ read: true })
      .where('"recipientId" = :userId AND "senderId" = :contactId AND read = false', { userId, contactId })
      .execute();

    return this.messages.find({
      where: [
        { sender: { id: userId }, recipient: { id: contactId } },
        { sender: { id: contactId }, recipient: { id: userId } },
      ],
      order: { createdAt: 'ASC' },
    });
  }

  async sendMessage(senderId: string, dto: SendMessageDto) {
    const content = dto.content?.trim();
    if (!content) {
      throw new BadRequestException('Message content is required');
    }

    const [sender, recipient] = await Promise.all([
      this.users.findOne({ where: { id: senderId } }),
      this.users.findOne({ where: { id: dto.recipientId } }),
    ]);

    if (!sender) {
      throw new NotFoundException('Sender not found');
    }
    if (!recipient) {
      throw new NotFoundException('Recipient not found');
    }
    if (recipient.id === sender.id) {
      throw new BadRequestException('Cannot send messages to yourself');
    }

    const saved = await this.messages.save(
      this.messages.create({ sender, recipient, content, read: false }),
    );

    this.realtime.emitToUser(recipient.id, 'message:created', saved);
    this.realtime.emitToUser(sender.id, 'message:created', saved);

    return saved;
  }
}
