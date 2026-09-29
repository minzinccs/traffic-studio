// Source transformation only: translate known static labels, never document data.
import ts from 'typescript';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('src');
const dictionary=fs.readFileSync(path.join(root,'features/localization/vi.ts'),'utf8');
const catalog=ts.createSourceFile('vi.ts',dictionary,ts.ScriptTarget.Latest,true);
const keys=new Set();
function collect(node){if(ts.isPropertyAssignment(node)&&ts.isStringLiteral(node.name))keys.add(node.name.text);ts.forEachChild(node,collect);}collect(catalog);
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(dir,entry.name)):[path.join(dir,entry.name)]);}
let total=0;
for(const file of files(root).filter(file=>file.endsWith('.tsx')&&!file.includes(`${path.sep}localization${path.sep}`))){
  const source=fs.readFileSync(file,'utf8');const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);const edits=[];
  function visit(node){
    if(ts.isJsxText(node)){
      const raw=node.getText(ast);const text=raw.trim();const parent=node.parent;
      const tag=ts.isJsxElement(parent)?parent.openingElement.tagName.getText(ast):'';
      if(keys.has(text)&&!['pre','textarea','script','style','option','code'].includes(tag)){
        const start=node.getStart(ast);const prefix=raw.slice(0,raw.indexOf(text));const suffix=raw.slice(raw.indexOf(text)+text.length);
        edits.push({start,end:node.end,text:`${prefix}<UiText text={${JSON.stringify(text)}}/>${suffix}`});
      }
    }
    ts.forEachChild(node,visit);
  }visit(ast);
  if(!edits.length)continue;
  let next=source;for(const edit of edits.sort((a,b)=>b.start-a.start))next=next.slice(0,edit.start)+edit.text+next.slice(edit.end);
  let relative=path.relative(path.dirname(file),path.join(root,'features/localization')).replaceAll('\\','/');if(!relative.startsWith('.'))relative='./'+relative;
  next=`import { UiText } from '${relative}';\n`+next;fs.writeFileSync(file,next);total+=edits.length;
}
console.log(`Translated ${total} catalog-backed static labels.`);
