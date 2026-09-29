type DecoderInput={data:string;sourceUrl:string};
let pending:DecoderInput|null=null;
export const decoderEvent='traffic-studio-open-decoder';
export function stageDecoderInput(input:DecoderInput){pending=input;window.dispatchEvent(new Event(decoderEvent));}
export function takeDecoderInput(){const value=pending;pending=null;return value;}
