import { Principal, TAccountId, bytesToHex, calculateMSQFee, debugStringify } from "@fort-major/masquerade-shared";
import { AccountCard } from "../../../../components/account-card";
import {
  ColorGray140,
  ColorGray165,
  H3,
  H5,
  Size12,
  Size16,
  Text,
  Weight500,
  Weight600,
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
  CopyIcon,
} from "./style";
import { EIconKind, Icon } from "../../../../ui-kit/icon";
import { Match, Show, Switch, createSignal } from "solid-js";
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
import { COLOR_ACCENT, COLOR_GRAY_140, COLOR_GRAY_165 } from "../../../../ui-kit";

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
                <Text size={12} weight={500} color={COLOR_GRAY_165}>
                  Principal ID
                </Text>
                <CheckoutFormInputField>
                  <Text size={16} weight={600} class={Elipsis}>
                    {props()!.recepientPrincipal}
                  </Text>
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
                <Text size={12} weight={500} color={COLOR_GRAY_165}>
                  Subaccount ID
                </Text>
                <CheckoutFormInputField>
                  <Text size={16} weight={600} class={Elipsis}>
                    {props()!.recepientSubaccount ? bytesToHex(props()!.recepientSubaccount!) : "Default Subaccount"}
                  </Text>
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
                <Text size={12} weight={500} color={COLOR_GRAY_165}>
                  Memo
                </Text>
                <CheckoutFormInputField>
                  <Text size={16} weight={600} class={Elipsis}>
                    {props()!.memo ? bytesToHex(props()!.memo!) : "-"}
                  </Text>
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
                <Text size={16} color={COLOR_GRAY_140}>
                  Amount
                </Text>
                <CheckoutFeeLineSum>
                  <Text size={16} weight={600} color={COLOR_GRAY_140}>
                    {tokensToStr(props()!.amount, props()!.decimals, undefined, true)}
                  </Text>
                  <Text size={12} weight={500} color={COLOR_GRAY_140}>
                    {props()!.symbol}
                  </Text>
                </CheckoutFeeLineSum>
              </CheckoutFeeLine>
              <CheckoutFeeLine>
                <Text size={16} color={COLOR_GRAY_140}>
                  MSQ Fee
                </Text>
                <CheckoutFeeLineSum>
                  <Text size={16} color={COLOR_GRAY_140} weight={600}>
                    {tokensToStr(msqFee, props()!.decimals, undefined, true)}
                  </Text>
                  <Text size={12} color={COLOR_GRAY_140} weight={500}>
                    {props()!.symbol}
                  </Text>
                </CheckoutFeeLineSum>
              </CheckoutFeeLine>
              <CheckoutFeeLine>
                <Text size={16} color={COLOR_GRAY_140}>
                  System Fee
                </Text>
                <CheckoutFeeLineSum>
                  <Text size={16} weight={600} color={COLOR_GRAY_140}>
                    {tokensToStr(calcSystemFee(), props()!.decimals, undefined, true)}
                  </Text>
                  <Text size={12} color={COLOR_GRAY_140} weight={500}>
                    {props()!.symbol}
                  </Text>
                </CheckoutFeeLineSum>
              </CheckoutFeeLine>
            </CheckoutFees>
            <CheckoutTotalWrapper>
              <CheckoutTotalInfo>
                <Text size={12} weight={500} color={COLOR_GRAY_140}>
                  Total Amount:
                </Text>
                <CheckoutTotalSum>
                  <H5>{tokensToStr(calcTotalAmount(), props()!.decimals, undefined, true)}</H5>
                  <Text size={12} weight={600}>
                    {props()!.symbol}
                  </Text>
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
