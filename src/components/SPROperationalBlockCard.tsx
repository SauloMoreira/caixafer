import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, Lock } from 'lucide-react';

interface Props {
  responsibleName?: string | null;
  hasOpenSession: boolean;
  onRequestTransfer?: () => void;
}

export default function SPROperationalBlockCard({ responsibleName, hasOpenSession, onRequestTransfer }: Props) {
  const isAnotherOperatorSession = hasOpenSession && !!responsibleName;

  return (
    <Card className="border-warning/30 bg-card shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/10 text-warning">
          <Lock className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-xl">SPR indisponível no momento</CardTitle>
          <CardDescription className="text-sm leading-6">
            {isAnotherOperatorSession
              ? 'O acesso ao SPR está restrito ao responsável atual pelo caixa.'
              : 'Você precisa estar com o caixa aberto para acessar o SPR.'}
          </CardDescription>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isAnotherOperatorSession ? (
          <div className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
            <p>
              O caixa está atualmente sob responsabilidade de <strong className="text-foreground">{responsibleName}</strong>.
            </p>
            <p className="mt-2">
              Para consultar o SPR e receber pagamentos, solicite a transferência do caixa.
            </p>
          </div>
        ) : (
          <div className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">
            <p>Abra o caixa ou receba a transferência da sessão para continuar.</p>
          </div>
        )}

        {onRequestTransfer && isAnotherOperatorSession ? (
          <Button variant="outline" className="h-11 w-full sm:w-auto" onClick={onRequestTransfer}>
            <ArrowRightLeft className="mr-2 h-4 w-4" />
            Solicitar transferência
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}