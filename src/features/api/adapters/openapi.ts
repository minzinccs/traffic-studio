import type { ApiCollection } from '../collections';
import { description,enforceLimits,list,object,profile,sensitive,text,warning,type ImportPreview } from './common';
export function importOpenApi(raw:unknown):ImportPreview {
  const root=object(raw,'OpenAPI document');if(!/^3\.[01]\./.test(text(root.openapi)))throw Error('Only OpenAPI 3.0/3.1 JSON is supported. YAML and Swagger2 are not translated.');
  const warnings:string[]=[];
  function dereference(raw:unknown,seen:string[]=[]):Record<string,unknown>{const value=object(raw);if(typeof value.$ref!=='string')return value;const ref=value.$ref;if(!ref.startsWith('#/')){warning(warnings,`External reference excluded: ${ref.slice(0,160)}`);return{};}if(seen.length>=16||seen.includes(ref)){warning(warnings,'Cyclic/deep references are excluded.');return{};}let next:unknown=root;for(const token of ref.slice(2).split('/')){const key=token.replace(/~1/g,'/').replace(/~0/g,'~');if(!next||typeof next!=='object'||!Object.hasOwn(next,key))throw Error(`Missing internal reference ${ref.slice(0,160)}.`);next=(next as Record<string,unknown>)[key];}return dereference(next,[...seen,ref]);}
  const info=object(root.info,'API info');const collection:ApiCollection={id:crypto.randomUUID(),name:text(info.title,'OpenAPI').slice(0,80),profiles:[],variables:[],parentId:null};
  for(const [path,rawPath] of Object.entries(object(root.paths,'OpenAPI paths'))){if(!path.startsWith('/'))throw Error('OpenAPI paths must begin with /.');const pathItem=dereference(rawPath);
    for(const method of ['get','post','put','patch','delete','head','options','trace']){if(!pathItem[method])continue;if(collection.profiles.length>=2000)throw Error('Import exceeds 2000 operations.');const operation=dereference(pathItem[method]);const servers=list(operation.servers??pathItem.servers??root.servers,'servers',100);const server=servers[0]?object(servers[0]):{url:'{{baseUrl}}'};
      let base=text(server.url,'{{baseUrl}}');const scoped=[];
      if(server.variables){for(const [key,rawVariable] of Object.entries(object(server.variables))){const variable=object(rawVariable);scoped.push({key,value:text(variable.default),secret:false});base=base.replaceAll(`{${key}}`,`{{${key}}}`);}}
      if(!servers.length){scoped.push({key:'baseUrl',value:'',secret:false});warning(warnings,'No server URL supplied. Set baseUrl before Send.');}
      if(base.startsWith('/'))warning(warnings,'Relative server URLs require a local base URL edit before Send.');
      const request=profile(text(operation.summary??operation.operationId,`${method.toUpperCase()} ${path}`),method.toUpperCase(),base.replace(/\/$/,'')+path.replace(/\{([^{}]+)\}/g,'{{$1}}'));
      request.variables=scoped;request.notes=description(operation.description);request.requestConfig!.docs=request.notes;
      const params=new Map<string,Record<string,unknown>>();for(const param of [...list(pathItem.parameters,'path parameters',1000),...list(operation.parameters,'parameters',1000)]){const value=dereference(param);params.set(`${text(value.in)}:${text(value.name)}`,value);}
      for(const param of params.values()){const name=text(param.name),kind=text(param.in);const schema=param.schema?dereference(param.schema):{};const example=param.example??schema.default??schema.example;const value=example===undefined?'':typeof example==='string'?example:JSON.stringify(example);
        if(param.style||param.explode!==undefined||schema.type==='array'||schema.type==='object')warning(warnings,'Complex parameter serialization needs review; examples are imported as draft strings.');
        if(kind==='path'){request.variables.push({key:name,value,secret:false});}
        else if(kind==='query')request.requestConfig!.params.push({id:request.requestConfig!.params.length+1,key:name,value,enabled:example!==undefined||param.required===true});
        else if(kind==='header'&&!sensitive(name))request.headers.push({key:name,value});
        else if(kind==='cookie'||sensitive(name))warning(warnings,'Credential/cookie parameters are excluded. Configure them in memory.');
      }
      if(operation.security||root.security)warning(warnings,'Security schemes are not applied automatically. Configure credentials before Send.');
      if(operation.callbacks||root.webhooks)warning(warnings,'Callbacks/webhooks are not imported as executable requests.');
      if(operation.requestBody){const body=dereference(operation.requestBody);const content=body.content?object(body.content):{};const entries=Object.entries(content);const chosen=entries.find(([mime])=>mime==='application/json')??entries[0];if(entries.length>1)warning(warnings,'Only the first preferred request media type is imported.');if(chosen){const [mime,rawMedia]=chosen;const media=object(rawMedia);let example=media.example;if(example===undefined&&media.examples){const examples=Object.values(object(media.examples));if(examples[0])example=dereference(examples[0]).value;}if(example===undefined&&media.schema)example=dereference(media.schema).example;if(example!==undefined){request.body=typeof example==='string'?example:JSON.stringify(example,null,2);}else warning(warnings,'Bodies without examples stay empty; schemas are not invented into payloads.');request.requestConfig!.bodyMode=mime.includes('json')?'JSON':mime.includes('xml')?'XML':'Text';if(mime.startsWith('multipart/')||mime==='application/x-www-form-urlencoded'){request.body='';warning(warnings,'OpenAPI form/file schemas need manual body field selection.');}else request.headers.push({key:'Content-Type',value:mime});}}
      if(operation.responses){request.notes+='\nDocumented responses: '+Object.keys(object(operation.responses)).join(', ');request.requestConfig!.docs=request.notes;}
      collection.profiles.push(request);
    }
  }
  if(!collection.profiles.length)throw Error('No supported HTTP operations found.');
  return enforceLimits({format:`OpenAPI ${root.openapi}`,collections:[collection],warnings});
}
