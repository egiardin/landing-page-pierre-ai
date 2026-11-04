(() => {
  'use strict';
  const config = window.PIERRE_CONFIG || {};
  const qs = (s) => document.querySelector(s);
  const qsa = (s) => [...document.querySelectorAll(s)];
  const toggle = qs('.menu-toggle');
  const nav = qs('#nav-links');
  function closeMenu() { nav.classList.remove('open'); toggle.setAttribute('aria-expanded','false'); toggle.setAttribute('aria-label','Ouvrir le menu'); }
  toggle.addEventListener('click', () => { const open = nav.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(open)); toggle.setAttribute('aria-label',open?'Fermer le menu':'Ouvrir le menu'); });
  nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',closeMenu));
  document.addEventListener('keydown', e=>{if(e.key==='Escape')closeMenu();});
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.classList.add('motion');
    const observer = new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target);}}),{threshold:.08});
    qsa('.reveal').forEach(e=>observer.observe(e));
  }
  const messages=qs('#messages'), input=qs('#chat-input'), chatForm=qs('#chat-form');
  const initialMessages=messages.innerHTML;
  let busy=false, history=[], chatController=null, chatRun=0;
  if(config.chatEndpoint) qs('#chat-mode').textContent='Pierre vous accompagne dans votre projet.';
  function bubble(text,role){const el=document.createElement('div');el.className=`message ${role}`;const p=document.createElement('p');p.textContent=text;p.style.whiteSpace='pre-line';el.append(p);messages.append(el);messages.scrollTop=messages.scrollHeight;return el;}
  function setBusy(value){busy=value;chatForm.querySelector('button').disabled=value;qsa('[data-question]').forEach(e=>e.disabled=value);messages.setAttribute('aria-busy',String(value));}
  function previewAnswer(question){
    const q=question.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    if(/prix|tarif|acheter|louer|location|offre|achat|cout/.test(q))return 'Deux formules sont prévues : acheter votre site ou le louer. Les tarifs et les services inclus seront communiqués avant toute commande. Vous pouvez déjà indiquer votre préférence dans le formulaire.';
    if(/sans site|zero|pas de site|nouveau|photos?/.test(q))return 'Vous pouvez commencer avec vos propres photos et les informations de votre hôtel. Dans le formulaire, choisissez « Je pars de zéro ». Avec un site existant, Pierre proposera de reprendre vos photos et vos textes.';
    if(/15|minute|temps|delai/.test(q))return 'Notre objectif est de passer de l’idée au déploiement en 15 minutes, avec vos contenus prêts. Les modifications et la connexion de votre nom de domaine peuvent demander plus de temps.';
    if(/domaine|heberg|azure|dns|technique/.test(q))return 'Votre site est prévu pour être publié sur votre nom de domaine et orienter les visiteurs vers votre moteur de réservation. Les modalités d’hébergement et de suivi seront précisées avec votre offre. La connexion du domaine peut demander une étape supplémentaire.';
    if(/seo|geo|google|referenc/.test(q))return 'Les modèles prévoient une structure claire, des titres et des contenus lisibles par les moteurs de recherche et les assistants IA. Aucune position dans les résultats n’est garantie.';
    if(/propriet|droit|resil|engage/.test(q))return 'Les conditions de propriété, d’hébergement, de maintenance et de sortie sont encore à préciser. Elles seront présentées avant toute commande, pour l’achat comme pour la location.';
    if(/marche|modele|design|animation|texte|personnalis/.test(q))return 'Vous choisissez un modèle avec ses animations et ses pages déjà organisées. Pierre vous guide dans chaque espace : choisir une photo, garder ou améliorer un texte, puis valider. Vous prévisualisez l’ensemble avant la mise en ligne.';
    return 'Cet aperçu présente le parcours de Pierre avec des réponses préécrites. La conversation IA sera disponible prochainement. Vous pouvez explorer les modèles, les deux formules et le formulaire de démo sur cette page.';
  }
  async function send(question){
    question=String(question||'').trim().slice(0,600);if(!question||busy)return;
    bubble(question,'visitor');input.value='';setBusy(true);const run=++chatRun;
    if(!config.chatEndpoint){bubble(previewAnswer(question),'bot');setBusy(false);input.focus();return;}
    const pending=bubble('Pierre prépare sa réponse…','bot');
    chatController=new AbortController();const timeout=setTimeout(()=>chatController?.abort(),30000);
    try{
      const response=await fetch(config.chatEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:question,history:history.slice(-12)}),signal:chatController.signal});
      if(!response.ok)throw new Error('HTTP');const result=await response.json();
      if(typeof result.answer!=='string'||!result.answer.trim())throw new Error('Réponse manquante');
      if(run!==chatRun)return;pending.remove();bubble(result.answer,'bot');history.push({role:'user',content:question},{role:'assistant',content:result.answer});
    }catch(e){if(run===chatRun){pending.remove();bubble('Pierre est momentanément indisponible. Réessayez dans un instant ou consultez les questions fréquentes.','bot');}}
    finally{clearTimeout(timeout);if(run===chatRun){setBusy(false);chatController=null;input.focus();}}
  }
  chatForm.addEventListener('submit',e=>{e.preventDefault();send(input.value);});
  qsa('[data-question]').forEach(b=>b.addEventListener('click',()=>send(b.dataset.question)));
  qs('#reset-chat').addEventListener('click',()=>{chatRun++;chatController?.abort();chatController=null;messages.innerHTML=initialMessages;history=[];setBusy(false);input.value='';messages.scrollTop=0;input.focus();});
  qsa('[data-plan]').forEach(a=>a.addEventListener('click',()=>{qs('#plan-choice').value=a.dataset.plan;}));
  const form=qs('#request-form'),status=qs('#form-status'),website=qs('#site-url');
  if(config.demoEndpoint)qs('#demo-mode').hidden=true;
  function originChanged(){const isNew=form.elements.origin.value==='new';qs('#website-field').hidden=isNew;website.disabled=isNew;website.required=!isNew;qs('#new-project-note').hidden=!isNew;status.textContent='';}
  qsa('[name="origin"]').forEach(e=>e.addEventListener('change',originChanged));
  form.addEventListener('submit',async e=>{
    e.preventDefault();if(!form.reportValidity())return;
    const data=Object.fromEntries(new FormData(form));
    if(data.fax)return;
    if(data.origin==='existing'){
      try{const url=new URL(data.website);if(!['http:','https:'].includes(url.protocol))throw new Error();}
      catch{status.textContent='Indiquez une adresse commençant par https:// ou http://.';website.focus();return;}
    }else data.website='';
    if(!config.demoEndpoint){status.textContent='L’envoi du lien personnel sera disponible prochainement. Aucune demande n’a été envoyée depuis cet aperçu.';return;}
    const button=form.querySelector('[type="submit"]');button.disabled=true;status.textContent='Enregistrement de votre demande…';
    const controller=new AbortController(), timeout=setTimeout(()=>controller.abort(),15000);
    try{
      const response=await fetch(config.demoEndpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:controller.signal});
      if(!response.ok)throw new Error();const result=await response.json();if(result.ok!==true)throw new Error();
      status.textContent=result.message||'Votre demande a été enregistrée. Vérifiez votre boîte email pour la suite.';
      if(result.demo_url){try{const url=new URL(result.demo_url);if(url.protocol==='https:'){const a=document.createElement('a');a.href=url.href;a.textContent='Ouvrir mon espace de démo ↗';a.target='_blank';a.rel='noopener noreferrer';status.append(document.createElement('br'),a);}}catch{}}
    }catch{status.textContent='Nous n’avons pas pu confirmer l’envoi. Vos informations restent dans le formulaire ; vous pouvez réessayer.';}
    finally{clearTimeout(timeout);button.disabled=false;}
  });
})();
