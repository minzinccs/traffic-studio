import type { JsonValue } from './workspace';
export type ScriptResult = {request:JsonValue;variables:Record<string,string>;assertions:{name:string;passed:boolean}[];logs:string[]};
export type ScriptInput = {id:string;source:string;context:JsonValue};
