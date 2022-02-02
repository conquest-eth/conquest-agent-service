import type {Env} from './types';
import {DO} from './DO';
import {createResponse} from './utils';
import {errorResponse} from './errors';
import {utils} from 'ethers';
import nacl from 'tweetnacl';
import base64 from 'byte-base64';

// needed because of : https://github.com/cloudflare/durable-objects-typescript-rollup-esm/issues/3
type State = DurableObjectState & {blockConcurrencyWhile: (func: () => Promise<void>) => void};

export type ProfileData = {
  description?: string;
  publicEncryptionKey: string;
  publicSigningKey: string;
  nonceMsTimestamp: number;
};

export type UpdateSubmission = {
  signedMessage: string;
};

export type Registration = {
  publicEncryptionKey: string;
  publicSigningKey: string;
  signature: string;
  update?: UpdateSubmission;
};

export type StoredMessage = {
  message: string;
  from: string;
};

export type MessageSubmission = {
  to: string;
  message: string;
  // TODO signature ?
  // encryption ?
  // TODO burnProof ?
};

function getTimestamp10ThSeconds(): number {
  return Math.floor(Date.now() / 100);
}

function lexicographicNumber12(num: number): string {
  return num.toString().padStart(12, '0');
}

export class Account extends DO {
  constructor(state: State, env: Env) {
    super(state, env);
  }

  async register(path: string[], registration: Registration): Promise<Response> {
    const accountAddress = path[0].toLowerCase();
    const accountID = `_${accountAddress}`;
    const addressFromSignature = utils.verifyMessage(
      `My Public Encryption Key is ${registration.publicEncryptionKey}\nMy Public Signing Key is ${registration.publicSigningKey}\n`,
      registration.signature
    );

    if (addressFromSignature.toLowerCase() !== accountAddress) {
      return errorResponse({code: 4000, message: 'invalid signature'});
    }

    const currentProfile = await this.state.storage.get<ProfileData | undefined>(accountID);
    if (currentProfile) {
      return errorResponse({code: 4444, message: 'Already registered'});
    }

    let description: string | undefined;
    if (registration.update) {
      // const signedMessage = nacl.sign(base64.base64ToBytes(base64.base64encode(message)), signingPair2.secretKey);
      // const messageBytes = nacl.sign.open(signedMessage, signingPair2.publicKey);
      // const messageAgain = base64.base64decode(base64.bytesToBase64(messageBytes));

      const messageBytes = nacl.sign.open(
        base64.base64ToBytes(registration.update.signedMessage),
        base64.base64ToBytes(registration.publicSigningKey)
      );
      const message = base64.base64decode(base64.bytesToBase64(messageBytes));
      if (!message) {
        return errorResponse({code: 4002, message: 'invalid signature'});
      }
      const json: {description: string} = JSON.parse(message);
      description = json.description;
    }

    this.state.storage.put<ProfileData>(accountID, {
      publicEncryptionKey: registration.publicEncryptionKey,
      publicSigningKey: registration.publicSigningKey,
      nonceMsTimestamp: 0,
      description,
    });
    return createResponse({success: true});
  }

  async get(path: string[]): Promise<Response> {
    const accountAddress = path[0].toLowerCase();
    const accountID = `_${accountAddress}`;
    const account = (await this.state.storage.get<ProfileData | undefined>(accountID)) || null;
    const data = {account};
    return createResponse(data);
  }

  async save(path: string[], update: UpdateSubmission): Promise<Response> {
    const msTimestamp = Math.floor(Date.now());
    const accountAddress = path[0].toLowerCase();
    const accountID = `_${accountAddress}`;

    let currentProfile = await this.state.storage.get<ProfileData | undefined>(accountID);
    if (!currentProfile) {
      return errorResponse({code: 4445, message: 'not registered'});
    }

    // const signedMessage = nacl.sign(base64.base64ToBytes(base64.base64encode(message)), signingPair2.secretKey);
    const messageBytes = nacl.sign.open(
      base64.base64ToBytes(update.signedMessage),
      base64.base64ToBytes(currentProfile.publicSigningKey)
    );
    const message = base64.base64decode(base64.bytesToBase64(messageBytes));
    if (!message) {
      return errorResponse({code: 4002, message: 'invalid signature'});
    }
    const json: {description: string; nonceMsTimestamp: number} = JSON.parse(message);

    if (
      !json.nonceMsTimestamp ||
      json.nonceMsTimestamp <= currentProfile.nonceMsTimestamp ||
      json.nonceMsTimestamp > msTimestamp
    ) {
      return errorResponse({code: 4002, message: 'invalid nonceMsTimestamp'});
    }

    currentProfile.description = json.description;
    this.state.storage.put<ProfileData>(accountID, currentProfile);
    return createResponse({success: true});
  }

  async send(path: string[], messageSubmission: MessageSubmission): Promise<Response> {
    const timestamp10Th = getTimestamp10ThSeconds();
    const toAddress = messageSubmission.to.toLowerCase();
    const toID = `_${toAddress}`;
    const fromID = ''; // TODO message signature // encryption ?

    await this.state.storage.put<StoredMessage>(`${toID}_t${lexicographicNumber12(timestamp10Th)}_f${fromID}`, {
      from: fromID,
      message: messageSubmission.message,
    });
    return createResponse({success: true});
  }

  async messages(path: string[]): Promise<Response> {
    const limit = 1000;
    const accountAddress = path[0].toLowerCase();
    const accountID = `_${accountAddress}`;

    // if not encrypted, require signature from request ? (path ? header ?)

    const messageEntries = (await this.state.storage.list({prefix: `${accountID}_t`, limit})) as
      | Map<string, StoredMessage>
      | undefined;

    const messages = [];
    if (messageEntries) {
      for (const messageEntry of messageEntries.entries()) {
        const message = messageEntry[1];
        // const messageId = messageEntry[0];
        messages.push(message);
      }
    }

    return createResponse({success: true, messages});
  }
}
