import { IGetSnapsResponse, ISnapRequest } from "./types";
import {
  type IIdentityLinkRequest,
  type IIdentityUnlinkRequest,
  type Principal,
  SNAP_METHODS,
  type TOrigin,
  delay,
  fromCBOR,
  toCBOR,
  log,
  logError,
} from "@fort-major/msq-shared";
import { SNAP_ID, SNAP_VERSION } from ".";
import { MsqIdentity } from "./identity";
import { ICRC35Connection, openICRC35Window } from "icrc-35";
import { MSQICRC35Client } from "./icrc35-client";
import isMobile from "ismobilejs";
import { MetaMaskSDK, SDKProvider } from "@metamask/sdk";
import { Identity } from "@dfinity/agent";

const DEFAULT_SHOULD_BE_FLASK = false;
const DEFAULT_DEBUG = false;
const DEFAULT_FORCE_REINSTALL = false;

export interface IMsqClientParams {
  /** snap id, for example `npm:@fort-major/msq` */
  snapId?: string | undefined;
  /** snap version, for example `0.2.0` */
  snapVersion?: string | undefined;
  /** whether the user should have MetaMask Flask installed */
  shouldBeFlask?: boolean | undefined;
  /** whether to log raw requests and responses */
  debug?: boolean | undefined;
  /** makes the snap re-install on every `.create()` invocation */
  forceReinstall?: boolean | undefined;
}

export type TMsqCreateResult =
  | TMsqCreateOk
  | TMsqCreateErrInstallMetaMask
  | TMsqCreateErrUnblockMetaMask
  | TMsqCreateErrEnableMetaMask
  | TMsqMobileNotSupported
  | TMsqConnectionRejected;

export type TMsqCreateOk = { Ok: MsqClient };
export type TMsqCreateErrInstallMetaMask = { InstallMetaMask: null } & TMsqCreateErr;
export type TMsqCreateErrUnblockMetaMask = { UnblockMSQ: null } & TMsqCreateErr;
export type TMsqCreateErrEnableMetaMask = { EnableMSQ: null } & TMsqCreateErr;
export type TMsqMobileNotSupported = { MobileNotSupported: null } & TMsqCreateErr;
export type TMsqConnectionRejected = { MSQConnectionRejected: null } & TMsqCreateErr;
export type TMsqCreateErr = {
  Err: "MSQConnectionRejected" | "MobileNotSupported" | "EnableMSQ" | "UnblockMSQ" | "InstallMetaMask";
};

export type TMsqCreateAndLoginResult =
  | TMsqCreateAndLoginOk
  | TMsqCreateErrInstallMetaMask
  | TMsqCreateErrUnblockMetaMask
  | TMsqCreateErrEnableMetaMask
  | TMsqMobileNotSupported
  | TMsqConnectionRejected;
export type TMsqCreateAndLoginOk = { Ok: { msq: MsqClient; identity: MsqIdentity } };

/**
 * ## A client to interact with the MSQ Snap
 */
export class MsqClient {
  private queueLocked: boolean = false;
  private isAuthorizedCache = false;

  /**
   * ## Returns true if the user is logged in current website
   *
   * @see {@link requestLogin}
   * @see {@link requestLogout}
   *
   * @returns
   */
  isAuthorized(): boolean {
    return this.isAuthorizedCache;
  }

  /**
   * Returns true if it is safe to resume the session after the user closes or refreshes the page
   *
   * @returns
   */
  static isSafeToResume(): boolean {
    return safeToAutoresume();
  }

  /**
   * ## Resumes the auth session if authorized
   *
   * @returns the identity object
   */
  resume(): Identity & MsqIdentity {
    return MsqIdentity.create(this) as unknown as Identity & MsqIdentity;
  }

  /**
   * ## Proposes the user to log in to current website
   *
   * Opens up a separate browser window with the MSQ website that will guide the user through the authorization process.
   * Under the hood uses ICRC-35 protocol.
   *
   * @see {@link requestLogout}
   * @see {@link isAuthorized}
   *
   * @returns - {@link MsqIdentity} if the login was a success, `null` otherwise
   */
  async requestLogin(peer?: ReturnType<typeof openICRC35Window>): Promise<(MsqIdentity & Identity) | null> {
    if (this.isAuthorized()) {
      peer?.peer.close();
      setSafeToAutoresume("true");

      return this.resume();
    }

    if (peer) {
      setTimeout(() => peer.peer.focus(), 100);
    }

    const w = peer ? peer : openICRC35Window(MSQICRC35Client.Origin);

    const connection = await ICRC35Connection.establish({
      mode: "parent",
      debug: this.debug,
      ...w,
    });
    const client = new MSQICRC35Client(connection);

    const loginResult = await client.login();

    connection.close();

    if (loginResult) {
      this.isAuthorizedCache = true;
      setSafeToAutoresume("true");
    }

    return loginResult ? MsqIdentity.create(this) : null;
  }

  /**
   * ## Proposes the user to log out from the current website
   *
   * Opens up a pop-up MetaMask window to confirm this action.
   *
   * @see {@link requestLogin}
   * @see {@link isAuthorized}
   *
   * @returns whether the user was logged out
   */
  async requestLogout(): Promise<boolean> {
    const result: boolean = await this._requestSnap(SNAP_METHODS.public.identity.requestLogout);

    if (result) {
      this.isAuthorizedCache = false;
      setSafeToAutoresume("false");
    }

    return result;
  }

  /**
   * ## Proposes the user to link all their masks on the current website to another website
   *
   * Opens up a pop-up MetaMask window to confirm this action.
   *
   * This will allow the user to log in to the target website using the same identities they use on this website.
   * This is useful for domain migration, so the users could continue to use their old principals when an app moves to another domain.
   *
   * The links are __unidirectional__ - this website won't be able to use target user's masks on the target website. The target website
   * should itself create another link (by calling this function for the user) to make that happen.
   *
   * @see {@link requestUnlink}
   * @see {@link getLinks}
   *
   * @param withOrigin - {@link TOrigin} - target website origin
   * @returns whether the user linked their masks
   */
  async requestLink(withOrigin: TOrigin): Promise<boolean> {
    const body: IIdentityLinkRequest = { withOrigin };

    return await this._requestSnap(SNAP_METHODS.public.identity.requestLink, body);
  }

  /**
   * ## Proposes the user to unlink all their masks on the current website from another website
   *
   * Opens up a pop-up MetaMask window to confirm this action.
   *
   * @see {@link requestLink}
   * @see {@link getLinks}
   *
   * @param withOrigin
   * @returns whether the user unlinked their masks
   */
  async requestUnlink(withOrigin: TOrigin): Promise<boolean> {
    const body: IIdentityUnlinkRequest = { withOrigin };

    return await this._requestSnap(SNAP_METHODS.public.identity.requestUnlink, body);
  }

  /**
   * ## Returns all user mask links coming from this website
   *
   * @see {@link requestLink}
   * @see {@link requestUnlink}
   *
   * @returns an array of {@link TOrigin} to which the current website created a link to
   */
  async getLinks(): Promise<TOrigin[]> {
    return await this._requestSnap(SNAP_METHODS.public.identity.getLinks);
  }

  /**
   * ## Proposes the user to transfer tokens via ICRC-1 token standard.
   *
   * Opens up a separate browser window with the MSQ website that will guide the user through the payment process.
   * Under the hood uses ICRC-35 protocol.
   *
   * This function greatly simplifies payments, since now you can just request the user to pay you for something,
   * without worrying about user identity being different on your website than on the wallet website.
   *
   * @param tokenCanisterId - {@link Principal} - a canister ID of the valid `ICRC-1` token
   * @param to.owner - {@link Principal} - payment recipient's `principal` ID
   * @param to.owner - (optional) {@link Uint8Array} - payment recipient's `subaccount` ID
   * @param amount - {@link bigint} - an amount of tokens that the user needs to transfer to the recepient (fees applied automatically)
   * @param memo - (optional) {@link Uint8Array} - memo field (32-bytes max) for transaction identification
   * @param createdAt - (optional) {@link bigint} - transaction creation time in nanoseconds (set automatically to `Date.now()` if not passed)
   * @returns - {@link bigint} - block ID that can be used for transaction verification or `null` if the payment failed
   */
  async requestICRC1Transfer(
    tokenCanisterId: Principal,
    to: { owner: Principal; subaccount?: Uint8Array | undefined },
    amount: bigint,
    memo?: Uint8Array | undefined,
    createdAt?: bigint | undefined,
  ): Promise<bigint | null> {
    const connection = await ICRC35Connection.establish({
      mode: "parent",
      debug: this.debug,
      ...openICRC35Window(MSQICRC35Client.Origin),
    });
    const client = new MSQICRC35Client(connection);

    const res = await client.pay({
      canisterId: tokenCanisterId.toText(),
      to: { owner: to.owner.toText(), subaccount: to.subaccount },
      amount,
      memo,
      createdAt: createdAt,
    });

    connection.close();

    return res;
  }

  async _requestSnap<T, R>(method: string, body?: T): Promise<R> {
    const req: ISnapRequest = {
      snapId: this.snapId,
      request: { method, params: { body: toCBOR(body) } },
    };

    return await this.process(req);
  }

  // serializes the queue, so all the requests are processed one-by-one
  private async process<R>(req: ISnapRequest): Promise<R> {
    const d = Math.floor(Math.random() * 13);

    while (this.queueLocked) {
      await delay(d);
    }

    this.queueLocked = true;

    if (this.debug) {
      const r = {
        snapId: req.snapId,
        request: {
          method: req.request.method,
          params: {
            body: fromCBOR(req.request.params.body),
          },
        },
      };

      log("sending", r, "to the wallet...");
    }

    const response = (await this.provider.request<string>({
      method: "wallet_invokeSnap",
      // @ts-expect-error
      params: req,
    }))!;

    const decodedResponse: R = fromCBOR(response);

    if (this.debug) {
      log("received", decodedResponse, "from the wallet");
    }

    this.queueLocked = false;

    return decodedResponse;
  }

  /**
   * ## Connects to the MSQ MetaMask Snap
   *
   * Opens up a MetaMask pop-up to guide the user through the process.
   *
   * Default parameters should work fine for most use-cases.
   *
   * This function will:
   *  - check if MetaMask is installed, throwing an error if not
   *  - check if the MSQ snap is installed, installing it automatically if not
   *
   * @param params - {@link IMsqClientParams}
   * @returns - an initialized {@link MsqClient} object that can be used right away or an Err
   */
  static async create(params?: IMsqClientParams): Promise<TMsqCreateResult> {
    if (isMobile(window.navigator).any) {
      return { MobileNotSupported: null, Err: "MobileNotSupported" };
    }

    let provider = await connectToMetaMask(params?.shouldBeFlask);

    if (provider === null) {
      return { InstallMetaMask: null, Err: "InstallMetaMask" };
    }

    const snapId = params?.snapId ?? SNAP_ID;
    const snapVersion = params?.snapVersion ?? SNAP_VERSION;
    const debug = params?.debug ?? DEFAULT_DEBUG;
    const forceReinstall = params?.forceReinstall ?? DEFAULT_FORCE_REINSTALL;

    let getSnapsResponse: IGetSnapsResponse = (await provider.request({ method: "wallet_getSnaps" }))!;
    let msqSnap = getSnapsResponse[snapId];

    if (msqSnap === undefined) {
      try {
        await provider.request({
          method: "wallet_requestSnaps",
          params: { [snapId]: { version: snapVersion } },
        });
      } catch (e) {
        logError("(Client connection)", e);
        return { MSQConnectionRejected: null, Err: "MSQConnectionRejected" };
      }
    }

    getSnapsResponse = (await provider.request({ method: "wallet_getSnaps" }))!;
    msqSnap = getSnapsResponse[snapId]!;

    if (msqSnap.blocked) {
      return { UnblockMSQ: null, Err: "UnblockMSQ" };
    }

    if (!msqSnap.enabled) {
      return { EnableMSQ: null, Err: "EnableMSQ" };
    }

    if (msqSnap.version !== snapVersion || forceReinstall) {
      await provider.request({
        method: "wallet_requestSnaps",
        params: { [snapId]: { version: snapVersion } },
      });
    }

    const client = new MsqClient(provider, snapId, debug);
    client.isAuthorizedCache = await client._requestSnap(SNAP_METHODS.public.identity.sessionExists);

    return { Ok: client };
  }

  /**
   * ## Same as `create` and `requestLogin`, but combined in one.
   * Useful in cases when the browser blocks popups, since it opens the MSQ page first thing and only then does all the stuff
   *
   * @param params - {@link IMsqClientParams}
   * @returns - an initialized {@link MsqClient} object that can be used right away or an Err
   */
  static async createAndLogin(params?: IMsqClientParams): Promise<TMsqCreateAndLoginResult> {
    const peer = safeToAutoresume() ? undefined : openICRC35Window(MSQICRC35Client.Origin);

    if (peer) {
      setTimeout(() => window.focus(), 100);
    }

    const createResult = await MsqClient.create(params);

    if ("Ok" in createResult) {
      const msq = createResult.Ok;
      const identity = await msq.requestLogin(peer);

      if (!identity) {
        setSafeToAutoresume("false");
        // throwing this in case the user rejects logging in
        // don't want to add another error type
        return { MSQConnectionRejected: null, Err: "MSQConnectionRejected" };
      }

      setSafeToAutoresume("true");

      return { Ok: { msq, identity } };
    }

    setSafeToAutoresume("false");
    peer?.peer.close();
    return createResult;
  }

  private constructor(
    private readonly provider: SDKProvider,
    private readonly snapId: string,
    private readonly debug: boolean,
  ) {}
}

export async function connectToMetaMask(shouldBeFlask?: boolean): Promise<SDKProvider | null> {
  const sdk = new MetaMaskSDK({
    dappMetadata: {
      name: "MSQ - Safe ICP Wallet",
      url: "https://msq.tech",
    },
    extensionOnly: true,
  });

  (window as any).sdk = sdk;

  try {
    await sdk.connect();
    const provider = sdk.getProvider();

    const version = await provider.request<string>({
      method: "web3_clientVersion",
    });
    const isFlask = version?.includes("flask");

    if ((shouldBeFlask ?? DEFAULT_SHOULD_BE_FLASK) && !isFlask) {
      return null;
    }

    return provider;
  } catch (e) {
    logError("(Client Connection)", e);

    return null;
  }
}

function safeToAutoresume() {
  return localStorage.getItem("msq-safe-to-autoresume") === "true";
}

function setSafeToAutoresume(has: "true" | "false") {
  localStorage.setItem("msq-safe-to-autoresume", has);
}
