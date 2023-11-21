import {
  DISCORD_LINK,
  Principal,
  TAccountId,
  bytesToHex,
  calculateMSQFee,
  debugStringify,
  originToHostname,
} from "@fort-major/masquerade-shared";
import { AccountCard } from "../../../../components/account-card";
import {
  H3,
  H5,
  Span400,
  Span500,
  Span600,
  SpanAccent,
  SpanError,
  SpanGray115,
  SpanGray130,
  SpanGray140,
  SpanGray165,
  SpanLink,
  Text12,
  Text14,
  Text16,
  Text20,
  Text24,
} from "../../../../ui-kit/typography";
import {
  CheckoutFeeLine,
  CheckoutFeeLineSum,
  CheckoutFees,
  CheckoutForm,
  CheckoutFormInput,
  CheckoutFormInputField,
  CheckoutPageContent,
  CheckoutPageWrapper,
  CheckoutTotalInfo,
  CheckoutTotalButtons,
  CheckoutTotalSum,
  CheckoutTotalWrapper,
  Elipsis,
  CheckoutResultContent,
  CheckoutResultSection,
  CheckoutResultBtn,
  CopyIcon,
} from "./style";
import { EIconKind, Icon } from "../../../../ui-kit/icon";
import { Match, Show, Switch, createEffect, createSignal } from "solid-js";
import { getRandomMemo, makeAgent, makeIcrc1Salt, tokensToStr } from "../../../../utils";
import { Button, EButtonKind } from "../../../../ui-kit/button";
import { referrerOrigin, usePaymentCheckoutPageProps } from "../../../../store/integration";
import { useNavigate } from "@solidjs/router";
import { useMasqueradeClient } from "../../../../store/global";
import { MasqueradeIdentity } from "@fort-major/masquerade-client";
import { IcrcLedgerCanister } from "@dfinity/ledger-icrc";
import { ITxnResult } from "../../../cabinet/my-assets/send";
import { TxnFailPage } from "../../../txn/fail";
import { TxnSuccessPage } from "../../../txn/success";
import { COLOR_ACCENT } from "../../../../ui-kit";

export interface IPaymentCheckoutPageProps {
  accountId: TAccountId;
  accountName: string;
  accountBalance: bigint;
  accountPrincipal?: string;

  assetId: string;
  symbol: string;
  decimals: number;
  fee: bigint;

  amount: bigint;
  recepientPrincipal: string;
  recepientSubaccount?: Uint8Array;
  memo?: Uint8Array;
  createdAt?: bigint;

  onSuccess(blockId: bigint): void;
  onFail(): void;
  onCancel(): void;
}

export function PaymentCheckoutPage() {
  const [props] = usePaymentCheckoutPageProps();
  const [loading, setLoading] = createSignal(false);
  const msq = useMasqueradeClient();
  const navigate = useNavigate();
  const [txnResult, setTxnResult] = createSignal<ITxnResult | null>(null);
  const [principalCopied, setPrincipalCopied] = createSignal(false);
  const [subaccountCopied, setSubaccountCopied] = createSignal(false);
  const [memoCopied, setMemoCopied] = createSignal(false);

  if (!props()) navigate("/");

  const handleCopyRecipientPrincipal = () => {
    navigator.clipboard.writeText(props()!.recepientPrincipal);
    setPrincipalCopied(true);
  };

  const handleCopyRecipientSubaccount = () => {
    navigator.clipboard.writeText(bytesToHex(props()!.recepientSubaccount!));
    setSubaccountCopied(true);
  };

  const handleCopyMemo = () => {
    navigator.clipboard.writeText(bytesToHex(props()!.memo!));
    setMemoCopied(true);
  };

  const [msqFee, msqRecipientId] = calculateMSQFee(props()!.assetId, props()!.amount);

  const calcSystemFee = () => (msqRecipientId ? props()!.fee * 2n : props()!.fee);

  const calcTotalAmount = () => props()!.amount + msqFee + calcSystemFee();

  const handlePay = async () => {
    setLoading(true);
    document.body.style.cursor = "wait";

    const totalAmount = calcTotalAmount();
    const totalAmountStr = tokensToStr(totalAmount, props()!.decimals, undefined, true);

    const agreed = await msq()!.showICRC1TransferConfirm({
      requestOrigin: referrerOrigin!,
      from: props()!.accountPrincipal!,
      to: {
        owner: props()!.recepientPrincipal,
        subaccount: props()!.recepientSubaccount,
      },
      totalAmountStr,
      totalAmount,
      ticker: props()!.symbol,
    });

    if (!agreed) {
      document.body.style.cursor = "unset";
      setLoading(false);
      return;
    }

    const identity = await MasqueradeIdentity.create(
      msq()!.getInner(),
      makeIcrc1Salt(props()!.assetId, props()!.accountId),
    );
    const agent = await makeAgent(identity);
    const ledger = IcrcLedgerCanister.create({ agent, canisterId: Principal.fromText(props()!.assetId) });

    try {
      const blockIdx = await ledger.transfer({
        created_at_time: props()!.createdAt ? props()!.createdAt : BigInt(Date.now()) * 1_000_000n,
        to: {
          owner: Principal.fromText(props()!.recepientPrincipal),
          subaccount: props()!.recepientSubaccount ? [props()!.recepientSubaccount!] : [],
        },
        amount: props()!.amount,
        memo: props()!.memo,
      });

      props()!.onSuccess(blockIdx);

      setTxnResult({
        success: true,
        blockIdx,
        totalAmount: totalAmountStr,
      });

      if (!msqRecipientId) return;

      try {
        await ledger.transfer({
          created_at_time: BigInt(Date.now()) * 1_000_000n,
          to: {
            owner: Principal.fromText(msqRecipientId),
            subaccount: [],
          },
          amount: msqFee,
          memo: getRandomMemo(),
        });
      } catch (e) {
        console.error("Have a happy day 😊 (unable to pay MSQ fee)", e);
      }
    } catch (e) {
      let err = debugStringify(e);

      props()!.onFail();

      setTxnResult({ success: false, error: err });
    } finally {
      document.body.style.cursor = "unset";
      setLoading(false);
    }
  };

  const handleClose = () => {
    window.close();
  };

  return (
    <CheckoutPageWrapper>
      <Switch>
        <Match when={txnResult() === null && props()}>
          <CheckoutPageContent>
            <H3>Send {props()!.symbol}</H3>
            <AccountCard
              fullWidth
              accountId={props()!.accountId}
              assetId={props()!.assetId}
              name={props()!.accountName}
              principal={props()!.accountPrincipal}
              balance={props()!.accountBalance}
              decimals={props()!.decimals}
              symbol={props()!.symbol}
            />
            <CheckoutForm>
              <CheckoutFormInput>
                <Text12>
                  <Span500>
                    <SpanGray165>Principal ID</SpanGray165>
                  </Span500>
                </Text12>
                <CheckoutFormInputField>
                  <Text16>
                    <Span600 class={Elipsis}>{props()!.recepientPrincipal}</Span600>
                  </Text16>
                  <Show
                    when={principalCopied()}
                    fallback={
                      <Icon
                        kind={EIconKind.Copy}
                        size={14}
                        onClick={handleCopyRecipientPrincipal}
                        classList={{ [CopyIcon]: true }}
                      />
                    }
                  >
                    <Icon
                      kind={EIconKind.Check}
                      size={14}
                      onClick={handleCopyRecipientPrincipal}
                      color={COLOR_ACCENT}
                    />
                  </Show>
                </CheckoutFormInputField>
              </CheckoutFormInput>
              <CheckoutFormInput>
                <Text12>
                  <Span500>
                    <SpanGray165>Subaccount ID</SpanGray165>
                  </Span500>
                </Text12>
                <CheckoutFormInputField>
                  <Text16>
                    <Span600 class={Elipsis}>
                      {props()!.recepientSubaccount ? bytesToHex(props()!.recepientSubaccount!) : "Default Subaccount"}
                    </Span600>
                  </Text16>
                  <Show when={props()!.recepientSubaccount}>
                    <Show
                      when={subaccountCopied()}
                      fallback={
                        <Icon
                          kind={EIconKind.Copy}
                          size={14}
                          onClick={handleCopyRecipientSubaccount}
                          classList={{ [CopyIcon]: true }}
                        />
                      }
                    >
                      <Icon
                        kind={EIconKind.Check}
                        size={14}
                        onClick={handleCopyRecipientSubaccount}
                        color={COLOR_ACCENT}
                      />
                    </Show>
                  </Show>
                </CheckoutFormInputField>
              </CheckoutFormInput>
              <CheckoutFormInput>
                <Text12>
                  <Span500>
                    <SpanGray165>Memo</SpanGray165>
                  </Span500>
                </Text12>
                <CheckoutFormInputField>
                  <Text16>
                    <Span600 class={Elipsis}>{props()!.memo ? bytesToHex(props()!.memo!) : "-"}</Span600>
                  </Text16>
                  <Show when={props()!.memo}>
                    <Show
                      when={memoCopied()}
                      fallback={
                        <Icon
                          kind={EIconKind.Copy}
                          size={14}
                          onClick={handleCopyMemo}
                          classList={{ [CopyIcon]: true }}
                        />
                      }
                    >
                      <Icon kind={EIconKind.Check} size={14} onClick={handleCopyMemo} color={COLOR_ACCENT} />
                    </Show>
                  </Show>
                </CheckoutFormInputField>
              </CheckoutFormInput>
            </CheckoutForm>
            <CheckoutFees>
              <CheckoutFeeLine>
                <Text16>
                  <SpanGray140>Amount</SpanGray140>
                </Text16>
                <CheckoutFeeLineSum>
                  <Text16>
                    <SpanGray140>
                      <Span600>{tokensToStr(props()!.amount, props()!.decimals, undefined, true)}</Span600>
                    </SpanGray140>
                  </Text16>
                  <Text12>
                    <SpanGray140>
                      <Span500>{props()!.symbol}</Span500>
                    </SpanGray140>
                  </Text12>
                </CheckoutFeeLineSum>
              </CheckoutFeeLine>
              <CheckoutFeeLine>
                <Text16>
                  <SpanGray140>MSQ Fee</SpanGray140>
                </Text16>
                <CheckoutFeeLineSum>
                  <Text16>
                    <SpanGray140>
                      <Span600>{tokensToStr(msqFee, props()!.decimals, undefined, true)}</Span600>
                    </SpanGray140>
                  </Text16>
                  <Text12>
                    <SpanGray140>
                      <Span500>{props()!.symbol}</Span500>
                    </SpanGray140>
                  </Text12>
                </CheckoutFeeLineSum>
              </CheckoutFeeLine>
              <CheckoutFeeLine>
                <Text16>
                  <SpanGray140>System Fee</SpanGray140>
                </Text16>
                <CheckoutFeeLineSum>
                  <Text16>
                    <SpanGray140>
                      <Span600>{tokensToStr(calcSystemFee(), props()!.decimals, undefined, true)}</Span600>
                    </SpanGray140>
                  </Text16>
                  <Text12>
                    <SpanGray140>
                      <Span500>{props()!.symbol}</Span500>
                    </SpanGray140>
                  </Text12>
                </CheckoutFeeLineSum>
              </CheckoutFeeLine>
            </CheckoutFees>
            <CheckoutTotalWrapper>
              <CheckoutTotalInfo>
                <Text12>
                  <Span500>
                    <SpanGray140>Total Amount:</SpanGray140>
                  </Span500>
                </Text12>
                <CheckoutTotalSum>
                  <H5>{tokensToStr(calcTotalAmount(), props()!.decimals, undefined, true)}</H5>
                  <Text12>
                    <Span600>{props()!.symbol}</Span600>
                  </Text12>
                </CheckoutTotalSum>
              </CheckoutTotalInfo>
              <CheckoutTotalButtons>
                <Button
                  kind={EButtonKind.Additional}
                  text="Cancel"
                  onClick={props()!.onCancel}
                  fullWidth
                  disabled={loading()}
                />
                <Button
                  kind={EButtonKind.Primary}
                  text="Continue"
                  icon={loading() ? EIconKind.Loader : EIconKind.ArrowRightUp}
                  onClick={handlePay}
                  fullWidth
                  disabled={loading()}
                />
              </CheckoutTotalButtons>
            </CheckoutTotalWrapper>
          </CheckoutPageContent>
        </Match>
        <Match when={txnResult()!.success}>
          <TxnSuccessPage
            assetId={props()!.assetId}
            accountId={props()!.accountId}
            accountName={props()!.accountName}
            accountPrincipal={props()!.accountPrincipal!}
            accountBalance={props()!.accountBalance}
            symbol={props()!.symbol}
            decimals={props()!.decimals}
            amount={calcTotalAmount()}
            blockId={txnResult()!.blockIdx!}
            onBack={handleClose}
          />
        </Match>
        <Match when={!txnResult()!.success}>
          <TxnFailPage error={txnResult()?.error!} onBack={handleClose} />
        </Match>
      </Switch>
    </CheckoutPageWrapper>
  );
}
