import { IsBoolean, IsEmail, IsEnum, IsNumber, IsOptional, IsString, Matches } from 'class-validator';
import { PASSWORD_REGEX, PASSWORD_RULE_MESSAGE } from '../../common/security';
import { Role } from './user.entity';

export class UpdateLocationDto {
  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;
}

export class RegisterDto {
  @IsEmail()
  email: string;
  @IsString()
  @Matches(PASSWORD_REGEX, { message: PASSWORD_RULE_MESSAGE })
  password: string;
  @IsOptional()
  @IsString()
  name?: string;
}

export class CreateUserDto extends RegisterDto {
  @IsEnum(Role)
  role: Role;
  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;
}

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;
  @IsOptional()
  @IsString()
  @Matches(PASSWORD_REGEX, { message: PASSWORD_RULE_MESSAGE })
  password?: string;
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
  @IsOptional()
  @IsString()
  name?: string;
  @IsOptional()
  @IsBoolean()
  isBlocked?: boolean;
}


/** Cambio de contraseña propio: exige la actual para que un token robado no
 *  baste para secuestrar la cuenta. */
export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @Matches(PASSWORD_REGEX, { message: PASSWORD_RULE_MESSAGE })
  newPassword: string;
}
