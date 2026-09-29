import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const packages=[];
function walk(directory){for(const entry of fs.readdirSync(directory,{withFileTypes:true})){if(!entry.isDirectory())continue;const folder=path.join(directory,entry.name);if(entry.name.startsWith('@')){walk(folder);continue;}const filename=path.join(folder,'package.json');if(!fs.existsSync(filename))continue;const p=JSON.parse(fs.readFileSync(filename,'utf8'));packages.push({ecosystem:'npm',name:p.name,version:p.version,license:p.license??null,repository:typeof p.repository==='object'?p.repository.url:p.repository??null,source:path.relative(root,folder)});if(fs.existsSync(path.join(folder,'node_modules')))walk(path.join(folder,'node_modules'));}}
walk(path.join(root,'node_modules'));if(fs.existsSync(path.join(root,'.runtime/whistle/node_modules')))walk(path.join(root,'.runtime/whistle/node_modules'));
const cargoHome=process.env.CARGO_HOME??path.join(process.env.USERPROFILE??'', '.cargo');
const registryRoot=path.join(cargoHome,'registry','src');
const registryFolders=fs.existsSync(registryRoot)?fs.readdirSync(registryRoot).map(x=>path.join(registryRoot,x)):[];
const lock=fs.readFileSync(path.join(root,'src-tauri/Cargo.lock'),'utf8');
for(const block of lock.split(/\r?\n\[\[package\]\]\r?\n/).slice(1)){
 const name=block.match(/^name = "([^"]+)"/m)?.[1],version=block.match(/^version = "([^"]+)"/m)?.[1],source=block.match(/^source = "([^"]+)"/m)?.[1];if(!name||!version||name==='traffic-studio')continue;
 const manifest=registryFolders.map(folder=>path.join(folder,`${name}-${version}`,'Cargo.toml')).find(fs.existsSync);
 const cargo=manifest?fs.readFileSync(manifest,'utf8'):'';
 const license=cargo.match(/^license\s*=\s*"([^"]+)"/m)?.[1]??null;
 packages.push({ecosystem:'cargo',name,version,license,repository:cargo.match(/^repository\s*=\s*"([^"]+)"/m)?.[1]??null,source:source??null});
}
const configPath=path.join(root,'.runtime/capture-runtime.json');
if(fs.existsSync(configPath)){
 const config=JSON.parse(fs.readFileSync(configPath,'utf8'));
 for(const folder of fs.readdirSync(config.sitePackages).filter(x=>x.endsWith('.dist-info'))){
  const metadataPath=path.join(config.sitePackages,folder,'METADATA');if(!fs.existsSync(metadataPath))continue;
  const metadata=fs.readFileSync(metadataPath,'utf8');const field=name=>metadata.match(new RegExp(`^${name}: (.*)$`,'m'))?.[1]?.trim()??null;
  const classifier=metadata.match(/^Classifier: License ::[^\r\n]*$/m)?.[0]?.split(' :: ')?.at(-1)??null;
  packages.push({ecosystem:'python',name:field('Name'),version:field('Version'),license:field('License-Expression')??field('License')??classifier,repository:field('Home-page'),source:path.relative(root,path.dirname(metadataPath))});
 }
}
packages.sort((a,b)=>`${a.ecosystem}:${a.name}:${a.version}`.localeCompare(`${b.ecosystem}:${b.name}:${b.version}`));const missing=packages.filter(p=>!p.license||p.license==='UNKNOWN');
fs.writeFileSync(path.join(root,'THIRD_PARTY_INVENTORY.json'),JSON.stringify({formatVersion:1,generatedAt:new Date().toISOString(),scope:'Installed development/engine candidates and Cargo dependency closure; broader than the final shipped subset',distributionAccepted:false,requiredFollowup:'Resolve missing/ambiguous licenses, assemble copyright/license notices and identify exact release-bundled assets/runtimes before packaging.',missingLicenses:missing.map(p=>({ecosystem:p.ecosystem,name:p.name,version:p.version})),packages},null,2)+'\n');
console.log(`Recorded ${packages.length} package versions; ${missing.length} missing license declarations. Distribution audit remains pending.`);
