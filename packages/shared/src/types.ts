import z from "zod";
import sanitizeHtml from "sanitize-html";

/**
 * Transforms any html into an escaped version of self.
 * For example "<p>haha</p>" will become "&lt;p&gt;haha&lt;p&gt;"
 *
 * @param dirty
 * @returns { string } - sanitized string
 */
export function escapeHtml(dirty: string): string {
  return sanitizeHtml(dirty, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: "escape",
  });
}

/**
 * A non-negative integer, e.g. 1337
 */
export const ZNonNegativeInt = z.number().int().nonnegative();

/**
 * A non-empty safe-to-use string
 */
export const ZNonEmptyStrSanitized = z.string().min(1).transform(escapeHtml);

/**
 * A principal string, e.g. aaaaa-aa
 */
export const ZPrincipalStrSanitized = z.string().regex(/^[0-9a-zA-Z]{1,5}(\-[0-9a-zA-Z]{1,5})*$/);
export const ZICRC1Subaccount = z.instanceof(Uint8Array);

/**
 * A 6-digit hex color code, e.g. #12beef
 */
export const ZHexColorSanitized = z.string().regex(/^#[a-fA-F0-9]{6}$/);

/**
 * Website origin, for example `https://google.com`
 */
export type TOrigin = z.infer<typeof ZOrigin>;
export const ZOrigin = z.string().url();

/**
 * Timestamp in millis
 */
export type TTimestamp = z.infer<typeof ZTimestamp>;
export const ZTimestamp = z.number().nonnegative();

/**
 * Blob of bytes
 */
export type TBlob = z.infer<typeof ZBlob>;
export const ZBlob = z.instanceof(ArrayBuffer).or(z.instanceof(Uint8Array));

/**
 * Identity ID
 */
export type TIdentityId = z.infer<typeof ZIdentityId>;
export const ZIdentityId = ZNonNegativeInt;

export type TAccountId = z.infer<typeof ZAccountId>;
export const ZAccountId = ZNonNegativeInt;

/**
 * Session object
 */
export type ISession = z.infer<typeof ZSession>;
export const ZSession = z.object({
  /** chosen user identity ID (unique for each website) */
  identityId: ZIdentityId,
  /** an origin used for key deriviation (actual or linked) */
  deriviationOrigin: ZOrigin,
  /** logged in timestamp */
  timestampMs: ZTimestamp,
});

export type IMask = z.infer<typeof ZMask>;
export const ZMask = z.object({ pseudonym: ZNonEmptyStrSanitized, principal: ZPrincipalStrSanitized });

/**
 * Various data for each website the user interacts with
 */
export type IOriginData = z.infer<typeof ZOriginData>;
export const ZOriginData = z.object({
  /** identities (and their pseudonyms) a user has on this website */
  masks: z.record(ZNonEmptyStrSanitized, z.optional(ZMask)),
  /** which websites shared the user's identity with this website */
  linksFrom: z.record(ZOrigin, z.optional(z.literal(true))),
  /** to which websites the user shared their identities from this website */
  linksTo: z.record(ZOrigin, z.optional(z.literal(true))),
  /** session object, exists if the user is logged in */
  currentSession: z.optional(ZSession),
});

export type IOriginDataExternal = z.infer<typeof ZOriginDataExternal>;
export const ZOriginDataExternal = z.object({
  masks: z.array(ZMask),
  linksFrom: z.array(ZOrigin),
  linksTo: z.array(ZOrigin),
  currentSession: z.optional(ZSession),
});

export const ZStatisticsData = z.object({
  login: ZNonNegativeInt,
  transfer: ZNonNegativeInt,
  origin_link: ZNonNegativeInt,
  origin_unlink: ZNonNegativeInt,
});
export type IStatisticsData = z.infer<typeof ZStatisticsData>;

/**
 * Anonimized and squashed activities the user does with MSQ
 */
export type IStatistics = z.infer<typeof ZStatistics>;
export const ZStatistics = z.object({
  /** when was the last time the user sent the stats to the server */
  lastResetTimestamp: ZNonNegativeInt,
  /** how many activities were performed in any production environment by each activity type */
  data: ZStatisticsData,
});

export const ZAmountStrSanitized = z.string().regex(/^[0-9',\.]+$/);
const ZAssetNameSanitized = z.string().min(1).transform(escapeHtml);
export const ZTickerStrSanitized = z.string().regex(/^[A-Za-z0-9]+$/);

export type IAssetData = z.infer<typeof ZAssetData>;
export const ZAssetData = z.object({
  name: ZAssetNameSanitized,
  symbol: ZTickerStrSanitized,
  fee: z.bigint().nonnegative(),
  decimals: ZNonNegativeInt,
  accounts: z.record(ZNonEmptyStrSanitized, ZNonEmptyStrSanitized),
});

export const ZAssetDataExternal = z.object({
  accounts: z.array(ZNonEmptyStrSanitized),
});
export type IAssetDataExternal = z.infer<typeof ZAssetDataExternal>;

/**
 * Snap state that is stored in encrypted form on user's device.
 *
 * !!! WARNING !!!
 * The state is only allowed to consist of records. No arrays. No classes. No recursion.
 * Only plain key-value pairs nested in each other.
 * This is required because of our deepProxy implementation.
 * If you break this rule, our state won't persist after mutations.
 */
export type IState = z.infer<typeof ZState>;
export const ZState = z.object({
  /** version of the state, for future migrations */
  version: ZNonNegativeInt,
  /** user data on each origin */
  originData: z.record(ZOrigin, z.optional(ZOriginData)),
  /** accounts for each asset */
  assetData: z.record(ZPrincipalStrSanitized, z.optional(ZAssetData)),
  /** anonymous usage stats */
  statistics: ZStatistics,
});

export const ZSnapRPCRequest = z.object({
  method: z.string(),
  params: z.object({
    body: z.string(),
  }),
});
export type ISnapRpcRequest = z.infer<typeof ZSnapRPCRequest>;

// ----------- IDENTITY PROTOCOL RELATED TYPES ---------

export const ZIdentityGetLoginOptionsRequest = z.object({
  forOrigin: ZOrigin,
});
export type IIdentityGetLoginOptionsRequest = z.infer<typeof ZIdentityGetLoginOptionsRequest>;

export const ZIdentityGetLoginOptionsResponse = z.array(z.tuple([ZOrigin, z.array(ZMask)]));
export type IIdentityGetLoginOptionsResponse = z.infer<typeof ZIdentityGetLoginOptionsResponse>;

export const ZIdentityAddRequest = z.object({
  toOrigin: ZOrigin,
});
export type IIdentityAddRequest = z.infer<typeof ZIdentityAddRequest>;

export const ZIdentityLoginRequest = z.object({
  /** Origin of the website to log in to */
  toOrigin: ZOrigin,
  /** Identity (mask) id of the user to use */
  withIdentityId: ZIdentityId,
  /** Linked origin, if the user wants to use it to log in */
  withLinkedOrigin: z.optional(ZOrigin),
});
export type IIdentityLoginRequest = z.infer<typeof ZIdentityLoginRequest>;

export const ZCallRequest = z
  .object({
    request_type: z.literal("call"),
    canister_id: ZPrincipalStrSanitized,
    method_name: ZNonEmptyStrSanitized,
    arg: ZBlob,
    sender: ZPrincipalStrSanitized.or(ZBlob),
    ingress_expiry: z.bigint().nonnegative(),
  })
  .passthrough();
export type ICallRequest = z.infer<typeof ZCallRequest>;

export const ZQueryRequest = z
  .object({
    request_type: z.literal("query"),
    canister_id: ZPrincipalStrSanitized,
    method_name: ZNonEmptyStrSanitized,
    arg: ZBlob,
    sender: ZPrincipalStrSanitized.or(ZBlob),
    ingress_expiry: z.bigint().nonnegative(),
  })
  .passthrough();
export type IQueryRequest = z.infer<typeof ZQueryRequest>;

export const ZCanisterRequest = ZCallRequest.or(ZQueryRequest);
export type ICanisterRequest = z.infer<typeof ZCanisterRequest>;

export const ZReadStateRequest = z
  .object({
    request_type: z.literal("read_state"),
    paths: z.array(z.array(ZBlob)),
    sender: ZPrincipalStrSanitized.or(ZBlob),
    ingress_expiry: z.bigint().nonnegative(),
  })
  .passthrough();
export type IReadStateRequest = z.infer<typeof ZReadStateRequest>;

export const ZHttpAgentRequest = z.discriminatedUnion("request_type", [ZCallRequest, ZQueryRequest, ZReadStateRequest]);
export type IHttpAgentRequest = z.infer<typeof ZHttpAgentRequest>;

export const ZIdentitySignRequest = z.object({
  request: ZHttpAgentRequest,
  salt: z.instanceof(Uint8Array),
});
export type IIdentitySignRequest = z.infer<typeof ZIdentitySignRequest>;

export const ZIdentityGetPublicKeyRequest = z.object({
  salt: z.instanceof(Uint8Array),
});
export type IIdentityGetPublicKeyRequest = z.infer<typeof ZIdentityGetPublicKeyRequest>;

export const ZIdentityLinkRequest = z.object({
  withOrigin: ZOrigin,
});
export type IIdentityLinkRequest = z.infer<typeof ZIdentityLinkRequest>;

export const ZIdentityUnlinkRequest = z.object({
  withOrigin: ZOrigin,
});
export type IIdentityUnlinkRequest = z.infer<typeof ZIdentityUnlinkRequest>;

export const ZIdentityEditPseudonymRequest = z.object({
  origin: ZOrigin,
  identityId: ZIdentityId,
  newPseudonym: ZNonEmptyStrSanitized,
});
export type IIdentityEditPseudonymRequest = z.infer<typeof ZIdentityEditPseudonymRequest>;

export const ZIdentityStopSessionRequest = z.object({
  origin: ZOrigin,
});
export type IIdentityStopSessionRequest = z.infer<typeof ZIdentityStopSessionRequest>;

export const ZIdentityUnlinkOneRequest = z.object({
  origin: ZOrigin,
  withOrigin: ZOrigin,
});
export type IIdentityUnlinkOneRequest = z.infer<typeof ZIdentityUnlinkOneRequest>;

export const ZIdentityUnlinkAllRequest = z.object({
  origin: ZOrigin,
});
export type IIdentityUnlinkAllRequest = z.infer<typeof ZIdentityUnlinkAllRequest>;

// ----------- STATISTICS PROTOCOL RELATED TYPES --------

export const ZStatisticsIncrementRequest = z.object({ data: ZStatisticsData.partial() });
export type IStatisticsIncrementRequest = z.infer<typeof ZStatisticsIncrementRequest>;

// ----------- STATE PROTOCOL RELATED TYPES -------------

export const ZStateGetAllOriginDataRequest = z.object({ origins: z.optional(z.array(ZOrigin)) });
export type IStateGetAllOriginDataRequest = z.infer<typeof ZStateGetAllOriginDataRequest>;

export const ZStateGetAllOriginDataResponse = z.record(ZOrigin, z.optional(ZOriginDataExternal));
export type IStateGetAllOriginDataResponse = z.infer<typeof ZStateGetAllOriginDataResponse>;

export const ZStateGetAllAssetDataRequest = z.object({ assetIds: z.optional(z.array(ZPrincipalStrSanitized)) });
export type IStateGetAllAssetDataRequest = z.infer<typeof ZStateGetAllAssetDataRequest>;

export const ZStateGetAllAssetDataResponse = z.record(ZPrincipalStrSanitized, z.optional(ZAssetDataExternal));
export type IStateGetAllAssetDataResponse = z.infer<typeof ZStateGetAllAssetDataResponse>;

// ----------- ICRC1 PROTOCOL RELATED TYPES -------------

export const ZICRC1Account = z.object({
  owner: ZPrincipalStrSanitized,
  subaccount: z.optional(ZICRC1Subaccount),
});
export type IICRC1Account = z.infer<typeof ZICRC1Account>;

export const ZICRC1TransferRequest = z.object({
  canisterId: ZPrincipalStrSanitized,
  to: ZICRC1Account,
  amount: z.bigint().nonnegative(),
  memo: z.optional(z.instanceof(Uint8Array)),
  createdAt: z.optional(z.bigint().nonnegative()),
});
export type IICRC1TransferRequest = z.infer<typeof ZICRC1TransferRequest>;

export const ZShowICRC1TransferConfirmRequest = z.object({
  requestOrigin: ZOrigin,
  from: ZPrincipalStrSanitized,
  to: ZICRC1Account,
  totalAmountStr: ZAmountStrSanitized,
  totalAmount: z.bigint().nonnegative(),
  ticker: ZTickerStrSanitized,
});
export type IShowICRC1TransferConfirmRequest = z.infer<typeof ZShowICRC1TransferConfirmRequest>;

export const ZICRC1AddAssetRequest = z.object({
  assets: z.array(
    z.object({
      assetId: ZPrincipalStrSanitized,
      name: ZAssetNameSanitized,
      symbol: ZTickerStrSanitized,
      fee: z.bigint().nonnegative(),
      decimals: ZNonNegativeInt,
    }),
  ),
});
export type IICRC1AddAssetRequest = z.infer<typeof ZICRC1AddAssetRequest>;

export const ZICRC1AddAssetAccountRequest = z.object({
  assetId: ZPrincipalStrSanitized,
});
export type IICRC1AddAssetAccountRequest = z.infer<typeof ZICRC1AddAssetAccountRequest>;

export const ZICRC1EditAssetAccountRequest = z.object({
  assetId: ZPrincipalStrSanitized,
  accountId: ZAccountId,
  newName: ZNonEmptyStrSanitized,
});
export type IICRC1EditAssetAccountRequest = z.infer<typeof ZICRC1EditAssetAccountRequest>;

// ----------- MSQ PAY TYPES ----------------------------

export const ZInvoiceId = z.instanceof(Uint8Array);
export type TInvoiceId = Uint8Array;

export const ZMSQPayRequest = z.object({
  invoiceId: ZInvoiceId,
});
export type IMSQPayRequest = z.infer<typeof ZMSQPayRequest>;

export const ZMSQPayResponse = z.null().or(
  z.object({
    blockIdx: z.bigint().positive(),
    tokenId: ZPrincipalStrSanitized,
  }),
);
export type IMSQPayResponse = z.infer<typeof ZMSQPayResponse>;

// ---------- MESSAGE TYPES ------------------------------

export const ZMsgDomain = z.literal("msq");

export const ZRequestReceivedMsg = z.object({
  domain: ZMsgDomain,
  type: z.literal("request_received"),
});
export type IRequestReceivedMsg = z.infer<typeof ZRequestReceivedMsg>;

export const ZLoginRequestMsg = z.object({
  domain: ZMsgDomain,
  origin: z.string().url(),
  type: z.literal("login_request"),
});
export type ILoginRequestMsg = z.infer<typeof ZLoginRequestMsg>;

export const ZLoginResultMsg = z.object({
  domain: ZMsgDomain,
  type: z.literal("login_result"),
  result: z.boolean(),
});
export type ILoginResultMsg = z.infer<typeof ZLoginResultMsg>;

export const ZICRC1TransferRequestMsg = z.object({
  domain: ZMsgDomain,
  origin: z.string().url(),
  type: z.literal("transfer_icrc1_request"),
  request: ZICRC1TransferRequest,
});
export type IICRC1TransferRequestMsg = z.infer<typeof ZICRC1TransferRequestMsg>;

export const ZICRC1TransferResultMsg = z.object({
  domain: ZMsgDomain,
  type: z.literal("transfer_icrc1_result"),
  result: z.optional(z.bigint()),
});
export type IICRC1TransferResultMsg = z.infer<typeof ZICRC1TransferResultMsg>;
