import {CineAccess} from '../server/cine-access.js';
export function fixture(){
 const values=new Map();let queue=Promise.resolve();
 const storage={transaction:fn=>{const call=queue.then(()=>fn({get:async k=>structuredClone(values.get(k)),put:async(k,v)=>values.set(k,structuredClone(v))}));queue=call.catch(()=>{});return call}};
 return {values,storage,room:new CineAccess({storage})};
}
