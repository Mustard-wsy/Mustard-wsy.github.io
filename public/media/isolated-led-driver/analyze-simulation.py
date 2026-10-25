from pathlib import Path
import json,subprocess,re
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
root=Path(__file__).resolve().parent
a=np.loadtxt(root/'transient.txt',skiprows=1)
fig,ax=plt.subplots(3,1,figsize=(10,7),sharex=True,layout='constrained')
ax[0].plot(a[:,0],a[:,1],color='#2465c7');ax[0].set_ylabel('Input (V)');ax[0].set_ylim(-.2,3.6)
ax[1].plot(a[:,0],a[:,5]*1000,color='#c73535');ax[1].set_ylabel('LED current (mA)');ax[1].set_ylim(-.4,10)
ax[2].plot(a[:,0],a[:,2],color='#228552');ax[2].set_ylabel('Optocoupler out (V)');ax[2].set_xlabel('Time (s), 0.5 Hz input')
for x in ax:x.grid(alpha=.25);x.set_xlim(0,4.2)
fig.suptitle('Isolated LED driver - SPICE typical-model simulation at 25 C',fontsize=14)
fig.savefig(root/'waveform.png',dpi=180);plt.close(fig)
rows=[]
for name,t in [('LOW',1.5),('HIGH',2.5)]:
 r=a[np.abs(a[:,0]-t).argmin()]
 rows.append({'state':name,'input_V':float(r[1]),'opto_out_V':float(r[2]),'base_V':float(r[3]),'collector_V':float(r[4]),'LED_mA':float(r[5]*1000),'opto_input_mA':float(r[6]*1000)})
(root/'results.json').write_text(json.dumps(rows,indent=2),encoding='utf-8')
print(json.dumps(rows,indent=2))
# Re-run static states under modest supply and generic-BJT gain variations.
base=(root/'LED_ISO.cir').read_text();body=base.split('.control')[0]
exe=root/'tools/ngspice/Spice64/bin/ngspice_con.exe'
sweep=[]
for v1,v2,beta in [(3.3,5,100),(3.135,4.75,50),(3.465,5.25,200)]:
 for logic in [0,1]:
  s=re.sub(r'Vinputpower IN_3V3 0 3.3',f'Vinputpower IN_3V3 0 {v1}',body)
  s=re.sub(r'Vinput SIG_IN 0 PULSE\([^\n]+\)',f'Vinput SIG_IN 0 {logic*v1}',s)
  s=s.replace('Voutputpower ISO_5V ISO_GND 5',f'Voutputpower ISO_5V ISO_GND {v2}').replace('BF=100',f'BF={beta}')
  s+='\n.control\nset wr_vecnames\nset wr_singlescale\nop\nlet iled=(v(ISO_5V)-v(LED_A))/330\nlet iopto=v(OPTO_K)/270\nwrdata static_tmp.txt iled iopto\nquit\n.endc\n.end\n'
  (root/'static_tmp.cir').write_text(s,encoding='ascii')
  p=subprocess.run([str(exe),'-b','-o','static_tmp.log','static_tmp.cir'],cwd=root,capture_output=True,timeout=20)
  if p.returncode:raise RuntimeError((root/'static_tmp.log').read_text(errors='replace'))
  d=np.loadtxt(root/'static_tmp.txt',skiprows=1)
  sweep.append({'inputSupply_V':v1,'outputSupply_V':v2,'genericBeta':beta,'logic':logic,'LED_mA':float(d[-2]*1000),'opto_mA':float(d[-1]*1000)})
(root/'sweep_results.json').write_text(json.dumps(sweep,indent=2),encoding='utf-8')
print('Static checks:',json.dumps(sweep,indent=2))
assert rows[0]['LED_mA']<.01 and 5<rows[1]['LED_mA']<15
assert all((r['LED_mA']<.01 if r['logic']==0 else 5<r['LED_mA']<15) for r in sweep)
print('Logic checks passed. Generic-model variation sweep is not a certified device corner analysis.')
