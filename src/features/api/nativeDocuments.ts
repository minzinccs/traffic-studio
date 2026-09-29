import type { ApiCollection } from './collections';
import type { SaveEntityInput,JsonValue } from '../../domain/workspace';
export function collectionDocuments(collections:ApiCollection[],workspaceId:string):SaveEntityInput[]{
  const documents:SaveEntityInput[]=[];
  for(const collection of collections){
    documents.push({workspaceId,id:collection.id,kind:'collection',name:collection.name,expectedRevision:0,payload:{parentId:collection.parentId??null,variables:collection.variables??[]} as unknown as Record<string,JsonValue>});
    for(const request of collection.profiles)documents.push({workspaceId,id:request.id,kind:'request',name:request.name,expectedRevision:0,payload:{documentType:'http_request',collectionId:collection.id,draft:{name:request.name,method:request.method,url:request.url,params:[],headers:request.headers.map((h,index)=>({...h,id:index+1,enabled:true})),body:request.body,auth:'',variables:request.variables??[],docs:request.notes,bodyMode:'Text',...request.requestConfig}} as unknown as Record<string,JsonValue>});
  }
  return documents;
}
