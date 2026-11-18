import {it,expect} from 'vitest';
import {validSiret,scheduleInput,profileInput,claimDecision} from '../src/lib/owners/policy';
it('contrôle le SIRET et refuse les clés ou formats invalides',()=>{expect(validSiret('73282932000074')).toBe(true);for(const s of ['73282932000075','732829320','00000000000000','7328293200007x'])expect(validSiret(s)).toBe(false)});
it('refuse horaires inversés et jours dupliqués',()=>{expect(scheduleInput.safeParse({hours:[{day:1,open:'18:00',close:'09:00'}],exceptions:[]}).success).toBe(false);expect(scheduleInput.safeParse({hours:[{day:1,open:'09:00',close:'18:00'},{day:1,open:'09:00',close:'18:00'}],exceptions:[]}).success).toBe(false)});
it('ne permet pas de forger un propriétaire via la fiche',()=>expect(profileInput.safeParse({claimed:true,siret:'73282932000074'}).success).toBe(false));
it('exige le contrôle humain avant approbation',()=>expect(claimDecision.safeParse({action:'APPROVE',reason:'Je valide cette demande.'}).success).toBe(false));
