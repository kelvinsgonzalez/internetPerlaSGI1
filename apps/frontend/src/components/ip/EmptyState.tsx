import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { FileQuestion, Plus } from "lucide-react";
import React from "react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            {icon || <FileQuestion className="h-8 w-8 text-muted-foreground" />}
          </div>
          <div className="space-y-2">
            <h3 className="font-medium">{title}</h3>
            <p className="text-sm text-muted-foreground max-w-sm">{description}</p>
          </div>
          {action && (
            <Button onClick={action.onClick}>
              <Plus className="mr-2 h-4 w-4" />
              {action.label}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

