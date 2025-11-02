import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { AlertCircle, RefreshCw } from "lucide-react";

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ 
  title = "Error al cargar los datos", 
  message = "No se pudieron cargar los datos. Por favor, intenta nuevamente.",
  onRetry 
}: ErrorStateProps) {
  return (
    <Card className="border-destructive/50">
      <CardContent className="py-12">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-2">
            <h3 className="font-medium text-destructive">{title}</h3>
            <p className="text-sm text-muted-foreground max-w-sm">{message}</p>
          </div>
          {onRetry && (
            <Button onClick={onRetry} variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Reintentar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

