-- Permitir que operadores SPR atualizem o status de qualquer fiado
-- necessário para que o registro de pagamento atualize corretamente o status da cobrança
-- mesmo que a cobrança tenha sido criada por outro operador ou em outro dia

DROP POLICY IF EXISTS "SPR operators can update fiado charge status" ON public.spr_fiado_charges;

CREATE POLICY "SPR operators can update fiado charge status"
ON public.spr_fiado_charges
FOR UPDATE
TO authenticated
USING (
  public.can_access_spr_operation()
)
WITH CHECK (
  public.can_access_spr_operation()
);
