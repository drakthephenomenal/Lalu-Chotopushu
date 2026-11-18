(function(){var B='__B__',D=__D__;
function fix(u){if(typeof u!=='string')return u;
var m=u.replace(/^https?:\/\/localhost\//,'');
if(/^(https?:|data:|blob:)/.test(m))return u;
var q=m.replace(/^\.?\//,''),c=q;try{c=decodeURI(q);}catch(e){}
for(var i=0;i<D.length;i++){if(c.indexOf(D[i])===0)return B+q;}
return u;}
var d=Object.getOwnPropertyDescriptor(HTMLImageElement.prototype,'src');
if(d&&d.set){Object.defineProperty(HTMLImageElement.prototype,'src',{get:d.get,set:function(v){d.set.call(this,fix(v));},configurable:true});}
var sa=Element.prototype.setAttribute;
Element.prototype.setAttribute=function(n,v){if(n==='src'&&this instanceof HTMLImageElement)v=fix(v);return sa.call(this,n,v);};
document.addEventListener('error',function(e){var t=e.target;
if(t&&t.tagName==='IMG'&&!t.getAttribute('data-lite')){var s=t.getAttribute('src')||'';var f=fix(s);
if(f!==s){t.setAttribute('data-lite','1');t.addEventListener('load',function(){t.style.display='';},{once:true});t.src=f;}}},true);
})();
