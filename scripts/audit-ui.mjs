import fs from 'node:fs'
import path from 'node:path'

const ROOT=path.resolve('src')
const files=[]
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else if(/\.(tsx|jsx)$/.test(entry.name))files.push(p)}}
walk(ROOT)

const sourceByFile=new Map(files.map((file)=>[file,fs.readFileSync(file,'utf8')]))

// Descobre exports nomeados realmente importados por outra parte da aplicação.
// Assim, componentes antigos/ilustrativos que permanecem no arquivo mas não são
// alcançáveis pela aplicação não geram falso bloqueio de lançamento.
const usedExports=new Map()
for(const [file,src] of sourceByFile){
  const importRe=/import\s*\{([\s\S]*?)\}\s*from\s*["']([^"']+)["']/g
  let match
  while((match=importRe.exec(src))){
    const spec=match[2]
    if(!spec?.startsWith('@/'))continue
    const rel=spec.slice(2)
    const candidates=[path.resolve('src',`${rel}.tsx`),path.resolve('src',`${rel}.jsx`),path.resolve('src',rel,'index.tsx'),path.resolve('src',rel,'index.jsx')]
    const target=candidates.find((candidate)=>sourceByFile.has(candidate))
    if(!target)continue
    const names=match[1].split(',').map((part)=>part.trim().split(/\s+as\s+/)[0]?.trim()).filter(Boolean)
    const set=usedExports.get(target)??new Set()
    for(const name of names)set.add(name)
    usedExports.set(target,set)
  }
}

function exportedFunctionRanges(src){
  const starts=[]
  const re=/export\s+function\s+(\w+)\s*\(/g
  let match
  while((match=re.exec(src)))starts.push({name:match[1],start:match.index})
  return starts.map((item,index)=>({...item,end:starts[index+1]?.start??src.length}))
}

function isInsideUnusedExport(file,src,offset){
  if(file.includes(`${path.sep}routes${path.sep}`))return false
  const range=exportedFunctionRanges(src).find((item)=>offset>=item.start&&offset<item.end)
  if(!range)return false
  const used=usedExports.get(file)
  if(used?.has(range.name))return false
  // Uso local explícito também torna o componente alcançável.
  const outside=src.slice(0,range.start)+src.slice(range.end)
  return !new RegExp(`<${range.name}\\b`).test(outside)
}

function readOpeningTag(src,start){
  let quote=null
  let braces=0
  for(let i=start;i<src.length;i+=1){
    const ch=src[i]
    const prev=src[i-1]
    if(quote){if(ch===quote&&prev!=='\\')quote=null;continue}
    if(ch==='"'||ch==="'"){quote=ch;continue}
    if(ch==='{'){braces+=1;continue}
    if(ch==='}'){braces=Math.max(0,braces-1);continue}
    if(ch==='>'&&braces===0)return src.slice(start,i+1)
  }
  return src.slice(start)
}

const findings=[]
for(const [file,src] of sourceByFile){
  const lines=src.split(/\r?\n/)
  const candidates=[...src.matchAll(/<Button\b/g)].map((match)=>({kind:'Button sem ação explícita',start:match.index??0,native:false}))
    .concat([...src.matchAll(/<button\b/g)].map((match)=>({kind:'button nativo sem ação explícita',start:match.index??0,native:true})))

  for(const candidate of candidates){
    if(isInsideUnusedExport(file,src,candidate.start))continue
    const tag=readOpeningTag(src,candidate.start)
    const safe=/\bonClick\s*=|\basChild\b|\btype\s*=\s*["']submit["']|\bdisabled(?:\s|=|\/?>)|\{\.\.\.[^}]+\}/.test(tag)
    if(safe)continue
    const nearby=src.slice(Math.max(0,candidate.start-220),candidate.start)
    const wrapped=/<(?:AlertDialogTrigger|DialogTrigger|DropdownMenuTrigger|SheetTrigger)[\s\S]*?asChild[\s\S]*?$/.test(nearby)
    if(wrapped)continue
    const line=src.slice(0,candidate.start).split(/\r?\n/).length
    findings.push({file:path.relative(process.cwd(),file),line,kind:candidate.kind,snippet:lines[line-1]?.trim()??''})
  }
}

if(findings.length){console.error(`\nAuditoria de UI: ${findings.length} ponto(s) alcançável(is) para revisar:\n`);for(const f of findings)console.error(`- ${f.file}:${f.line} — ${f.kind}\n  ${f.snippet}`);process.exitCode=1}else console.log('Auditoria de UI: nenhum botão alcançável sem ação explícita encontrado.')
