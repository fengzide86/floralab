(function(){
'use strict';

function create({state,onNavigate,onCreativeSpace,onInstall}){
  if(!state)throw new Error('FloraLabShell requires state');
  if(typeof onNavigate!=='function')throw new Error('FloraLabShell requires onNavigate');
  if(typeof onCreativeSpace!=='function')throw new Error('FloraLabShell requires onCreativeSpace');
  if(typeof onInstall!=='function')throw new Error('FloraLabShell requires onInstall');

  const $=(selector,root=document)=>root.querySelector(selector);
  const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
  const app=$('#app');

  function nav(active=''){
    return `<nav class="nav"><button class="wordmark" data-go="home"><img class="brand-mark" src="icons/icon-32.png" alt="" aria-hidden="true">FloraLab</button><div class="nav-links">${state.plan?`<button class="nav-link ${active==='work'?'active':''}" data-go="result">作品</button>`:''}<button class="nav-link hide-mobile ${active==='render'?'active':''}" data-go="render">效果图</button><button class="nav-link hide-mobile ${active==='materials'?'active':''}" data-go="materials">材料库</button><button class="nav-link hide-mobile ${active==='create'?'active':''}" data-go="create">新建</button><button class="nav-link hide-mobile" id="installApp">安装 App</button><button class="nav-more" id="navMore" aria-expanded="false" aria-controls="mobileMenu">菜单</button><button class="nav-new" id="creativeSpace">创作空间</button></div><div class="mobile-menu" id="mobileMenu" hidden><button data-go="render">效果图工作区</button><button data-go="materials">材料库</button><button data-go="create">新建作品</button><button id="installAppMobile">安装 FloraLab</button></div></nav>`;
  }

  function closeMobileMenu(){
    const menu=$('#mobileMenu');
    const more=$('#navMore');
    if(menu)menu.setAttribute('hidden','');
    if(more)more.setAttribute('aria-expanded','false');
  }

  function render(body,active=''){
    app.innerHTML=`${nav(active)}${body}`;

    $$('[data-go]').forEach(button=>{
      button.onclick=()=>{
        closeMobileMenu();
        onNavigate(button.dataset.go||'');
      };
    });

    const creative=$('#creativeSpace');
    if(creative)creative.onclick=onCreativeSpace;

    const install=$('#installApp');
    if(install)install.onclick=onInstall;

    const installMobile=$('#installAppMobile');
    if(installMobile)installMobile.onclick=()=>{
      closeMobileMenu();
      onInstall();
    };

    const more=$('#navMore');
    const menu=$('#mobileMenu');
    if(more&&menu){
      more.onclick=()=>{
        const open=menu.hasAttribute('hidden');
        menu.toggleAttribute('hidden',!open);
        more.setAttribute('aria-expanded',String(open));
      };
    }
  }

  return {nav,render,closeMobileMenu};
}

globalThis.FloraLabShell={create};
})();
