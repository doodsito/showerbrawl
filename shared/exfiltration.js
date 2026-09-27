// Shared timing: authoritative immunity and client animation use the same phases.
export const EXFIL = Object.freeze({lift:.35,away:1,return:2.5,land:3.15,end:3.5});
export const isExtracted = p => !!p.exfil && p.exfil.age >= EXFIL.lift && p.exfil.age < EXFIL.land;
