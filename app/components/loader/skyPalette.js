/*
 * Time-of-day palette for the loader, so its sky is the sky the 3D scene opens
 * on (no three.js import: this runs before the 3D chunk has downloaded).
 *
 * Mirrors three/v2/lighting/atmosphere.js: the same art-directed sun model
 * (sunrise 06:00, sunset 20:15, 55° at noon) and the same zenith/horizon
 * keyframes, keyed by sun elevation. Keep both in sync when the lighting is
 * re-graded. The script string below inlines this for the pre-hydration paint.
 */

export const SKY_SCRIPT = `(function(){try{
var el=document.currentScript&&document.currentScript.parentNode;if(!el)return;
var d=new Date(),h=d.getHours()+d.getMinutes()/60;
var q=/[?&]hour=([0-9.]+)/.exec(location.search);if(q)h=parseFloat(q[1])%24;
var R=6,S=20.25,M=55,N=35,L=S-R,x=((h-R)%24+24)%24,e;
e=x<=L?Math.sin(Math.PI*x/L)*M:-Math.sin(Math.PI*(x-L)/(24-L))*N;
var K=[[-90,"050a1a","0e1a35"],[-14,"060c22","122042"],[-9,"101a46","283468"],[-5,"232b68","76588e"],[-2,"38488c","d88896"],[1,"5670b4","f5a172"],[5,"6a8fcb","f8c897"],[12,"6c9bd6","f0dcc4"],[25,"6aa2e0","d6e5f2"],[90,"5f9ce0","cde0f2"]];
function c(s){return[parseInt(s.slice(0,2),16),parseInt(s.slice(2,4),16),parseInt(s.slice(4,6),16)]}
function m(a,b,t){var A=c(a),B=c(b);return"rgb("+A.map(function(v,i){return Math.round(v+(B[i]-v)*t)}).join(" ")+")"}
var i=1;while(i<K.length-1&&e>K[i][0])i++;var a=K[i-1],b=K[i],t=Math.min(1,Math.max(0,(e-a[0])/(b[0]-a[0])));t=t*t*(3-2*t);
el.style.setProperty("--sky-top",m(a[1],b[1],t));el.style.setProperty("--sky-bottom",m(a[2],b[2],t));
el.dataset.mood=e<-4?"night":e<9?"golden":"day";
}catch(_){}})();`;
