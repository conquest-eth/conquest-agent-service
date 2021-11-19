// export enum ErrorCode {

import {createResponse} from './utils';

// }

export type ResponseError = {
  code: number; //ErrorCode;
  message: string;
};

export const TransactionInvalidFunctionSignature = () =>
  errorResponse({code: 4000, message: 'tx invalid, invalid function sig'});
export const TransactionInvalidNoData = () => errorResponse({code: 4001, message: 'tx invalid, no data'});
export const TransactionInvalidUnrecoverableSIgner = () =>
  errorResponse({code: 4002, message: 'tx invalid, cannot recover signer'});
export const TransactionInvalidMissingFields = () =>
  errorResponse({code: 4003, message: 'duration, startTime, sendTxHash are all required'});
export const NonceAlreadyUsed = () => errorResponse({code: 4004, message: 'nonce already used'});
export const TransactionCanAlreadyBeRevealed = () =>
  errorResponse({code: 4101, message: 'transaction can already be revealed'});
export const RevealTimeNotInOrder = () => errorResponse({code: 4102, message: 'reveal time not in order'});
export const NoncesNotInOrder = () => errorResponse({code: 4103, message: 'nonce not in order'});
export const NoReveal = () => errorResponse({code: 5000, message: 'UNEXPECTED ERROR: No Reveal'}, 500);
export const AlreadyPending = () =>
  errorResponse({code: 4005, message: 'Transaction for that reveal is already underway'}); // TODO parametrise to print tx info (hash, nonce)

export const InvalidFeesScheduleSubmission = () =>
  errorResponse({
    code: 4008,
    message: 'Invalid submission for fee schedule, need to be an array of 3 elements with delay in increasing order',
  });

export const DifferentChainIdDetected = () =>
  errorResponse({code: 5556, message: 'different chainId detected, please check the ethereum node config'});
export const PaymentAddressChangeDetected = () =>
  errorResponse({code: 5555, message: 'the payment contract address has changed'});

export const InvalidMethod = () => errorResponse({code: 4444, message: 'Invalid Method'});

export const NotAuthorized = () => errorResponse({code: 4202, message: 'Not authorized'});
export const NotRegistered = () => errorResponse({code: 4200, message: 'Account not registered'});
export const NotEnoughBalance = () =>
  errorResponse({code: 4201, message: 'Account have less than the minimum balance'}); // TODO parametrise to print balance required
export const InvalidNonce = () => errorResponse({code: 4300, message: 'invalid nonce provided/signed'});

export const NoDelegateRegistered = () =>
  errorResponse({code: 4400, message: 'No Delegate registered for that account'});
export const InvalidDelegate = () =>
  errorResponse({code: 4401, message: 'Delegate not matching with the one registered with that account'});

export const UnknownRequestType = () => errorResponse({code: 4401, message: 'Unknown request type'}); // TODO parametrise to print request type

export function errorResponse(responseError: ResponseError, status: number = 400): Response {
  return createResponse(responseError, {status});
}
