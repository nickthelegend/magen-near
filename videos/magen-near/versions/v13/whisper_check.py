import subprocess,json,re,difflib,os
root='videos/magen-near/versions/v13';out=[]
for s in json.load(open(root+'/narration.json')):
 p=root+'/voice/'+s['id'];subprocess.run(['ffmpeg','-y','-v','error','-i',p+'.wav','-ar','16000','-ac','1',p+'-16k.wav'],check=True)
 r=subprocess.run(['whisper-cli','-m','/Users/jaibajrang/.cache/hyperframes/whisper/models/ggml-small.en.bin','-f',p+'-16k.wav','-nt','-np'],capture_output=True,text=True)
 a=re.sub('[^a-z0-9 ]','',s['text'].lower()).split();b=re.sub('[^a-z0-9 ]','',r.stdout.lower()).split();row={'id':s['id'],'expected':s['text'],'transcript':r.stdout.strip(),'similarity':round(difflib.SequenceMatcher(None,a,b).ratio(),3)};out.append(row);print(row,flush=True)
 json.dump(out,open(root+'/whisper-check.json','w'),indent=2)
