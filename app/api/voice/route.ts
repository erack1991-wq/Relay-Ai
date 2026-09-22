import { handleVoice } from '@/lib/voice-workflow';
export const dynamic='force-dynamic';
export const POST=(request:Request)=>handleVoice(request,true);
