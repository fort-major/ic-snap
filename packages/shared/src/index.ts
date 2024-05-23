import { type ZodType, type z } from "zod";
import { type TOrigin } from "./types";
import { debugStringify } from "./encoding";

export * from "./types";
export * from "./encoding";
export * from "./avatar";

/**
 * ## Enumerates all available MSQ snap methods
 *
 * There are two kinds of methods:
 *  - __public__ - these methods can be called from any origin, but all changes and data are scoped to that origin
 *  - __protected__ - these methods can only be called from the MSQ website
 */
export const SNAP_METHODS = {
  protected: {
    identity: {
      add: "protected_identity_add",
      login: "protected_identity_login",
      getLoginOptions: "protected_identity_getLoginOptions",
      editPseudonym: "protected_identity_editPseudonym",
      stopSession: "protected_identity_stopSession",
      unlinkOne: "protected_identity_unlinkOne",
      unlinkAll: "protected_identity_unlinkAll",
    },
    icrc1: {
      addAsset: "protected_icrc1_addAsset",
      addAssetAccount: "protected_icrc1_addAssetAccount",
      editAssetAccount: "protected_icrc1_editAssetAccount",
    },
    statistics: {
      get: "protected_statistics_get",
      increment: "protected_statistics_increment",
      reset: "protected_statistics_reset",
    },
    state: {
      getAllOriginData: "protected_state_getAllOriginData",
      getAllAssetData: "protected_state_getAllAssetData",
    },
  },
  public: {
    identity: {
      sign: "public_identity_sign",
      getPublicKey: "public_identity_getPublicKey",

      getPseudonym: "public_identity_getPseudonym",

      requestLogout: "public_identity_requestLogout",
      requestLink: "public_identity_requestLink",
      requestUnlink: "public_identity_requestUnlink",
      getLinks: "public_identity_getLinks",
      sessionExists: "public_identity_sessionExists",
    },
  },
};
export type TProtectedSnapMethodsKind = keyof typeof SNAP_METHODS.protected;

export enum ErrorCode {
  UNKOWN = "MSQ_UNKNOWN",
  INVALID_RPC_METHOD = "MSQ_INVALID_RPC_METHOD",
  INVALID_INPUT = "MSQ_INVALID_INPUT",
  IC_ERROR = "MSQ_IC_ERROR",
  PROTECTED_METHOD = "MSQ_PROTECTED_METHOD",
  ICRC1_ERROR = "MSQ_ICRC1_ERROR",
  METAMASK_ERROR = "MSQ_METAMASK_ERROR",
  UNAUTHORIZED = "MSQ_UNAUTHORIZED",
  SECURITY_VIOLATION = "MSQ_SECURITY_VIOLATION",
  UNWRAP_ERROR = "MSQ_UNWRAP_ERROR",
}

export function err(code: ErrorCode, msg: string): never {
  throw new Error(`[${code}]: ${msg}`);
}

export function unreacheable(msg?: string): never {
  if (msg === undefined) {
    throw new Error("Unreacheable");
  } else {
    throw new Error(`Unreacheable: ${msg}`);
  }
}

export async function delay(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generates a string representing the current time in HH:MM:SS format.
 * This function retrieves the current time using the Date object, then formats
 * the hours, minutes, and seconds to ensure they are always displayed as two digits,
 * padding with a leading zero if necessary. This is useful for displaying the time
 * in a consistent format across various parts of an application.
 *
 * @returns {string} The current time formatted as a string in "HH:MM:SS" format.
 */
function makeTime(): string {
  const now = new Date();

  const h = now.getHours().toString().padStart(2, "0");
  const m = now.getMinutes().toString().padStart(2, "0");
  const s = now.getSeconds().toString().padStart(2, "0");

  return `${h}:${m}:${s}`;
}

export function log(...args: any[]) {
  console.log(`[${makeTime()}]`, "<MSQ>", ...args);
}

export function logError(...args: any[]) {
  console.error(`[${makeTime()}]`, "<MSQ>", ...args);
}

/**
 * Parses an object against a given Zod schema, handling errors specifically for the MetaMask Snaps environment.
 * In the MetaMask Snaps environment, errors not descending from `Error` are not thrown normally. This function
 * uses a Zod schema to parse and validate an input object. If the object does not conform to the schema, it
 * catches the resulting Zod error and manually triggers an error specific to the MetaMask Snaps environment
 * by using a custom error function. This is necessary because Zod errors, which do not directly extend from `Error`,
 * may not be properly thrown or caught in MetaMask Snaps without this handling.
 *
 * @param {S} schema - The Zod schema to validate the input object against.
 * @param {unknown} obj - The input object to validate.
 * @returns {z.infer<typeof schema>} The parsed object, if it conforms to the schema.
 * @throws Will trigger a custom error with `ErrorCode.INVALID_INPUT` if parsing fails.
 */
export function zodParse<S extends ZodType>(schema: S, obj: unknown): z.infer<typeof schema> {
  try {
    return schema.parse(obj);
  } catch (e) {
    err(ErrorCode.INVALID_INPUT, debugStringify(e));
  }
}

/**
 * Converts a URL origin into its hostname.
 * This function takes a URL origin as input and utilizes the URL API to parse it,
 * extracting the hostname part of the URL. This is particularly useful for scenarios
 * where you need to obtain the domain name from a full URL or origin string.
 *
 * @param {TOrigin} origin - The origin URL string from which to extract the hostname.
 * @returns {string} The hostname extracted from the provided origin URL string.
 */
export function originToHostname(origin: TOrigin): string {
  return new URL(origin).hostname;
}

type PreListedToken = {
  name: string;
  symbol: string;
  assetId: string;
  snsId?: string;
  logoSrc?: string;
  chargingAccountId?: string;
  fee: bigint;
  decimals: number;
};

export const PRE_LISTED_TOKENS: Record<string, PreListedToken> = {
  "ryjl3-tyaaa-aaaaa-aaaba-cai": {
    name: "Internet Computer",
    symbol: "ICP",
    assetId: "ryjl3-tyaaa-aaaaa-aaaba-cai",
    logoSrc: "https://nns.ic0.app/_app/immutable/assets/icp-rounded.0be14f6b.svg",
    fee: 10_000n,
    decimals: 8,
  },
  "jwcfb-hyaaa-aaaaj-aac4q-cai": {
    name: "Origyn",
    symbol: "OGY",
    assetId: "jwcfb-hyaaa-aaaaj-aac4q-cai",
    logoSrc: "https://msq.tech/ogy.svg",
    fee: 200_000n,
    decimals: 8,
  },
  "mxzaz-hqaaa-aaaar-qaada-cai": {
    name: "Bitcoin",
    symbol: "ckBTC",
    assetId: "mxzaz-hqaaa-aaaar-qaada-cai",
    fee: 10n,
    decimals: 8,
  },
  "ss2fx-dyaaa-aaaar-qacoq-cai": {
    name: "Ethereum",
    symbol: "ckETH",
    assetId: "ss2fx-dyaaa-aaaar-qacoq-cai",
    fee: 2_000_000_000_000n,
    decimals: 18,
  },
  "xevnm-gaaaa-aaaar-qafnq-cai": {
    name: "ckUSDC",
    symbol: "ckUSDC",
    assetId: "xevnm-gaaaa-aaaar-qafnq-cai",
    fee: 10_000n,
    decimals: 6,
  },

  // ----------------  sns based tokens  ------------------
  "vtrom-gqaaa-aaaaq-aabia-cai": {
    name: "BOOM DAO",
    symbol: "BOOM",
    assetId: "vtrom-gqaaa-aaaaq-aabia-cai",
    snsId: "xjngq-yaaaa-aaaaq-aabha-cai",
    logoSrc: "https://3r4gx-wqaaa-aaaaq-aaaia-cai.icp0.io/v1/sns/root/xjngq-yaaaa-aaaaq-aabha-cai/logo.png",
    fee: 100_000n,
    decimals: 8,
  },
  "uf2wh-taaaa-aaaaq-aabna-cai": {
    name: "Catalyze",
    symbol: "CTZ",
    logoSrc: "https://3r4gx-wqaaa-aaaaq-aaaia-cai.icp0.io/v1/sns/root/uly3p-iqaaa-aaaaq-aabma-cai/logo.png",
    assetId: "uf2wh-taaaa-aaaaq-aabna-cai",
    snsId: "uly3p-iqaaa-aaaaq-aabma-cai",
    fee: 100_000n,
    decimals: 8,
  },
  "zfcdd-tqaaa-aaaaq-aaaga-cai": {
    name: "Dragginz",
    symbol: "DKP",
    assetId: "zfcdd-tqaaa-aaaaq-aaaga-cai",
    snsId: "zxeu2-7aaaa-aaaaq-aaafa-cai",
    fee: 100_000n,
    decimals: 8,
  },
  "gemj7-oyaaa-aaaaq-aacnq-cai": {
    name: "ELNA AI",
    symbol: "ELNA",
    assetId: "gemj7-oyaaa-aaaaq-aacnq-cai",
    snsId: "gkoex-viaaa-aaaaq-aacmq-cai",
    fee: 100_000n,
    decimals: 8,
  },
  "bliq2-niaaa-aaaaq-aac4q-cai": {
    name: "EstateDAO",
    symbol: "EST",
    assetId: "bliq2-niaaa-aaaaq-aac4q-cai",
    snsId: "abhsa-pyaaa-aaaaq-aac3q-cai",
    fee: 100_000n,
    decimals: 8,
  },
  "tyyy3-4aaaa-aaaaq-aab7a-cai": {
    name: "Gold DAO",
    symbol: "GLDGov",
    assetId: "tyyy3-4aaaa-aaaaq-aab7a-cai",
    snsId: "tw2vt-hqaaa-aaaaq-aab6a-cai",
    fee: 100_000n,
    decimals: 8,
  },
  "6rdgd-kyaaa-aaaaq-aaavq-cai": {
    name: "Hot or Not",
    symbol: "HOT",
    logoSrc: "https://3r4gx-wqaaa-aaaaq-aaaia-cai.icp0.io/v1/sns/root/67bll-riaaa-aaaaq-aaauq-cai/logo.png",
    assetId: "6rdgd-kyaaa-aaaaq-aaavq-cai",
    snsId: "67bll-riaaa-aaaaq-aaauq-cai",
    fee: 100_000n,
    decimals: 8,
  },
  "4c4fd-caaaa-aaaaq-aaa3a-cai": {
    name: "ICGhost",
    symbol: "GHOST",
    logoSrc: "https://3r4gx-wqaaa-aaaaq-aaaia-cai.icp0.io/v1/sns/root/4m6il-zqaaa-aaaaq-aaa2a-cai/logo.png",
    assetId: "4c4fd-caaaa-aaaaq-aaa3a-cai",
    snsId: "4m6il-zqaaa-aaaaq-aaa2a-cai",
    fee: 100_000_000n,
    decimals: 8,
  },
  "hhaaz-2aaaa-aaaaq-aacla-cai": {
    name: "ICLighthouse DAO",
    symbol: "ICL",
    assetId: "hhaaz-2aaaa-aaaaq-aacla-cai",
    snsId: "hjcnr-bqaaa-aaaaq-aacka-cai",
    fee: 1_000_000n,
    decimals: 8,
  },
  "druyg-tyaaa-aaaaq-aactq-cai": {
    name: "ICPanda DAO",
    symbol: "PANDA",
    assetId: "druyg-tyaaa-aaaaq-aactq-cai",
    snsId: "d7wvo-iiaaa-aaaaq-aacsq-cai",
    fee: 10_000n,
    decimals: 8,
  },
  "ca6gz-lqaaa-aaaaq-aacwa-cai": {
    name: "ICPSwap",
    symbol: "ICS",
    assetId: "ca6gz-lqaaa-aaaaq-aacwa-cai",
    snsId: "csyra-haaaa-aaaaq-aacva-cai",
    fee: 1_000_000n,
    decimals: 8,
  },
  "rffwt-piaaa-aaaaq-aabqq-cai": {
    name: "ICX",
    symbol: "ICX",
    assetId: "rffwt-piaaa-aaaaq-aabqq-cai",
    snsId: "u67kc-jyaaa-aaaaq-aabpq-cai",
    fee: 100_000n,
    decimals: 8,
  },
  "73mez-iiaaa-aaaaq-aaasq-cai": {
    name: "Kinic",
    symbol: "KINIC",
    logoSrc: "https://3r4gx-wqaaa-aaaaq-aaaia-cai.icp0.io/v1/sns/root/7jkta-eyaaa-aaaaq-aaarq-cai/logo.png",
    assetId: "73mez-iiaaa-aaaaq-aaasq-cai",
    snsId: "7jkta-eyaaa-aaaaq-aaarq-cai",
    fee: 100_000n,
    decimals: 8,
  },
  "xsi2v-cyaaa-aaaaq-aabfq-cai": {
    name: "Modclub",
    symbol: "MOD",
    logoSrc: "https://3r4gx-wqaaa-aaaaq-aaaia-cai.icp0.io/v1/sns/root/x4kx5-ziaaa-aaaaq-aabeq-cai/logo.png",
    assetId: "xsi2v-cyaaa-aaaaq-aabfq-cai",
    snsId: "x4kx5-ziaaa-aaaaq-aabeq-cai",
    fee: 10_000n,
    decimals: 8,
  },
  "k45jy-aiaaa-aaaaq-aadcq-cai": {
    name: "Motoko",
    symbol: "MOTOKO",
    assetId: "k45jy-aiaaa-aaaaq-aadcq-cai",
    snsId: "ko36b-myaaa-aaaaq-aadbq-cai",
    fee: 10_000n,
    decimals: 8,
  },
  "f54if-eqaaa-aaaaq-aacea-cai": {
    name: "Neutrinite",
    symbol: "NTN",
    assetId: "f54if-eqaaa-aaaaq-aacea-cai",
    snsId: "extk7-gaaaa-aaaaq-aacda-cai",
    fee: 10_000n,
    decimals: 8,
  },
  "rxdbk-dyaaa-aaaaq-aabtq-cai": {
    name: "Nuance",
    symbol: "NUA",
    assetId: "rxdbk-dyaaa-aaaaq-aabtq-cai",
    snsId: "rzbmc-yiaaa-aaaaq-aabsq-cai",
    fee: 100_000n,
    decimals: 8,
  },
  "2ouva-viaaa-aaaaq-aaamq-cai": {
    name: "OpenChat",
    symbol: "CHAT",
    logoSrc: "https://3r4gx-wqaaa-aaaaq-aaaia-cai.icp0.io/v1/sns/root/3e3x2-xyaaa-aaaaq-aaalq-cai/logo.png",
    assetId: "2ouva-viaaa-aaaaq-aaamq-cai",
    snsId: "3e3x2-xyaaa-aaaaq-aaalq-cai",
    fee: 100_000n,
    decimals: 8,
  },
  "ddsp7-7iaaa-aaaaq-aacqq-cai": {
    name: "OpenFPL",
    assetId: "ddsp7-7iaaa-aaaaq-aacqq-cai",
    snsId: "gyito-zyaaa-aaaaq-aacpq-cai",
    symbol: "FPL",
    fee: 100_000n,
    decimals: 8,
  },
  "hvgxa-wqaaa-aaaaq-aacia-cai": {
    name: "Sneed",
    symbol: "SNEED",
    assetId: "hvgxa-wqaaa-aaaaq-aacia-cai",
    snsId: "fp274-iaaaa-aaaaq-aacha-cai",
    fee: 1_000n,
    decimals: 8,
  },
  "qbizb-wiaaa-aaaaq-aabwq-cai": {
    name: "SONIC",
    symbol: "SONIC",
    assetId: "qbizb-wiaaa-aaaaq-aabwq-cai",
    snsId: "qtooy-2yaaa-aaaaq-aabvq-cai",
    fee: 100_000n,
    decimals: 8,
  },
  "emww2-4yaaa-aaaaq-aacbq-cai": {
    name: "TRAX",
    symbol: "TRAX",
    assetId: "emww2-4yaaa-aaaaq-aacbq-cai",
    snsId: "ecu3s-hiaaa-aaaaq-aacaq-cai",
    fee: 100_000n,
    decimals: 8,
  },
  "atbfz-diaaa-aaaaq-aacyq-cai": {
    name: "Yuku DAO",
    symbol: "YUKU",
    assetId: "atbfz-diaaa-aaaaq-aacyq-cai",
    snsId: "cj5nf-5yaaa-aaaaq-aacxq-cai",
    fee: 1_000_000n,
    decimals: 8,
  },
};

/**
 * Calculates the MSQ fee for a given asset and amount.
 * This function looks up an asset by its ID in a predefined list of tokens (`PRE_LISTED_TOKENS`),
 * and if found, calculates the MSQ fee based on the amount being transacted. The MSQ fee is defined
 * as 1% of the transaction amount. If the asset ID does not match any entry in the pre-listed tokens
 * or if the found entry does not have a `chargingAccountId`, it returns zero as the fee and `undefined`
 * for the `chargingAccountId`.
 *
 * @param {string} assetId - The ID of the asset for which to calculate the fee.
 * @param {bigint} amount - The amount of the asset being transacted, from which to calculate the fee.
 * @returns {[bigint, string | undefined]} A tuple containing the calculated MSQ fee and the charging account ID
 *                                        associated with the asset, or `undefined` if the asset is not found or
 *                                        has no charging account ID.
 */
export function calculateMSQFee(assetId: string, amount: bigint): [bigint, string | undefined] {
  const entry = Object.values(PRE_LISTED_TOKENS).find(({ assetId: id }) => id === assetId);
  if (!entry) return [0n, undefined];

  const { assetId: _, chargingAccountId } = entry;
  if (!chargingAccountId) return [0n, undefined];

  const msqFee = amount / 100n;

  return [msqFee, chargingAccountId];
}

export const ICP_INDEX_TOKEN_IDX = ["ryjl3-tyaaa-aaaaa-aaaba-cai", "jwcfb-hyaaa-aaaaj-aac4q-cai"];

export const DISCORD_LINK = "https://discord.gg/RMxyF5Huhs";
export const METAMASK_LINK = "https://metamask.io/download/";
