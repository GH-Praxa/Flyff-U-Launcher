const fs=require('fs');
const md=fs.readFileSync('app/docs/documentation_de.md','utf8');
function processDocContent(md){return md;}
function markdownToHtmlExtended(md){
  const accordionRegex=/(::{3,})accordion\[([^\]]+)\]\n((?:(?!:{3,}accordion\[)[\s\S])*?)\1(?!:)/g;
  let processed=md;
  let hadAccordion=false;
  while(accordionRegex.test(processed)){
    hadAccordion=true;
    accordionRegex.lastIndex=0;
    processed=processed.replace(accordionRegex,(_m,_c,title,content)=>{
      const body=markdownToHtmlExtended(content.trim());
      return `<ACC title="${title}">${body}</ACC>`;
    });
  }
  processed=processed.replace(/:::info\n([\s\S]*?):::/g,(_m,c)=>`<INFO>${c}</INFO>`);
  processed=processed.replace(/:::warning\n([\s\S]*?):::/g,(_m,c)=>`<WARN>${c}</WARN>`);
  if(!hadAccordion){
    return processed.trim();
  }
  return processed;
}
console.log(markdownToHtmlExtended(md));
