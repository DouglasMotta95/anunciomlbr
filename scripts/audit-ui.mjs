import fs from 'node:fs'
import path from 'node:path'

const ROOT=path.resolve('src')
const files=[]
function walk(dir){for(const entry of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,entry.name);if(entry.isDirectory())walk(p);else if(/\.(tsx|jsx)$/.test(entry.name))files.push(p)}}
walk(ROOT)

const findings=[]
for(const file of files){const src=fs.readFileSync(file,'utf8');const lines=src.split(/\r?\n/)
  const buttonRe=/<Button\b([^>]*)>/gms;let m
  while((m=buttonRe.exec(src))){const attrs=m[1]??'';const offset=m.index;const line=src.slice(0,offset).split(/\r?\n/).length;const safe=/\bonClick\s*=|\basChild\b|\btype\s*=\s*["']submit["']|\bAlertDialogTrigger\b|\bDialogTrigger\b/.test(attrs)
    if(!safe){const nearby=src.slice(Math.max(0,offset-180),Math.min(src.length,offset+500));const wrapped=/<(?:AlertDialogTrigger|DialogTrigger|DropdownMenuTrigger|SheetTrigger)[\s\S]*?asChild[\s\S]*?$/.test(nearby)
      if(!wrapped)findings.push({file:path.relative(process.cwd(),file),line,kind:'Button sem ação explícita',snippet:lines[line-1]?.trim()??''})}}
  const nativeRe=/<button\b([^>]*)>/gms
  while((m=nativeRe.exec(src))){const attrs=m[1]??'';const line=src.slice(0,m.index).split(/\r?\n/).length;if(!/\bonClick\s*=|\btype\s*=\s*["']submit["']/.test(attrs))findings.push({file:path.relative(process.cwd(),file),line,kind:'button nativo sem ação explícita',snippet:lines[line-1]?.trim()??''})}
}

if(findings.length){console.error(`\nAuditoria de UI: ${findings.length} ponto(s) para revisar:\n`);for(const f of findings)console.error(`- ${f.file}:${f.line} — ${f.kind}\n  ${f.snippet}`);process.exitCode=1}else console.log('Auditoria de UI: nenhum botão sem ação explícita encontrado.')
