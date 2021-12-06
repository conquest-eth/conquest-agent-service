// TODO take from common-lib
import {utils} from 'ethers';
import {BigNumber} from 'ethers';
const {hexConcat, hexZeroPad} = utils;

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export function createResponse(data: any, options?: {status: number}): Response {
  return new Response(JSON.stringify(data, null, '  '), {
    headers: {...corsHeaders, 'content-type': 'application/json;charset=UTF-8'},
    status: options?.status,
  });
}

export function locationToXY(location: string): {x: number; y: number} {
  let x;
  let y = 0;
  const l = location.length;
  if (l <= 34) {
    x = BigNumber.from(location).fromTwos(128).toNumber();
  } else {
    x = BigNumber.from('0x' + location.slice(l - 32))
      .fromTwos(128)
      .toNumber();
    y = BigNumber.from(location.slice(0, l - 32))
      .fromTwos(128)
      .toNumber();
  }
  return {
    x,
    y,
  };
}

function toByteString(from: number, width: number): string {
  return hexZeroPad(BigNumber.from(from).toTwos(width).toHexString(), Math.floor(width / 8));
}

export function xyToLocation(x: number, y: number): string {
  const xStr = toByteString(x, 128);
  const yStr = toByteString(y, 128);

  const location = hexConcat([yStr, xStr]);
  // const check = locationToXY(location);
  // if (check.x != x || check.y != y) {
  //   throw new Error("conversion errro");
  // }
  return location;
}
