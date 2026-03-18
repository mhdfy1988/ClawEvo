# Workspace Build Graph And Cache Strategy

杩欎唤鏂囨。鐢ㄦ潵鍥炵瓟 3 涓棶棰橈細

- 褰撳墠 workspace 鐨勭紪璇戜緷璧栧浘鍒板簳鏄粈涔?- 涓轰粈涔堟垜浠幇鍦ㄥ厛涓嶅紩鍏?`tsc -b`
- 褰撳墠宸茬粡钀戒笅鏉ョ殑澧為噺鏋勫缓涓庡苟鍙戜繚鎶ょ瓥鐣ユ槸浠€涔?
鐩稿叧鏂囨。锛?- [post-split-cleanup-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/post-split-cleanup-todo.zh-CN.md)
- [workspace-test-and-release-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-test-and-release-boundary.zh-CN.md)

## 褰撳墠渚濊禆鍥?
褰撳墠鍙彂甯?workspace 鐨勭紪璇戜緷璧栧浘濡備笅锛?
- `@openclaw-compact-context/contracts`
  - 鏃犱緷璧?- `@openclaw-compact-context/runtime-core`
  - 渚濊禆 `@openclaw-compact-context/contracts`
- `@openclaw-compact-context/compact-context-core`
  - 渚濊禆 `@openclaw-compact-context/contracts`
- `@openclaw-compact-context/openclaw-adapter`
  - 渚濊禆 `@openclaw-compact-context/contracts`
  - 渚濊禆 `@openclaw-compact-context/runtime-core`
- `@openclaw-compact-context/control-plane-shell`
  - 渚濊禆 `@openclaw-compact-context/contracts`
  - 渚濊禆 `@openclaw-compact-context/compact-context-core`
- `@openclaw-compact-context/compact-context`
  - 渚濊禆 `@openclaw-compact-context/compact-context-core`
  - 渚濊禆 `@openclaw-compact-context/openclaw-adapter`
- `@openclaw-compact-context/control-plane`
  - 渚濊禆 `@openclaw-compact-context/compact-context-core`
  - 渚濊禆 `@openclaw-compact-context/openclaw-adapter`
  - 渚濊禆 `@openclaw-compact-context/control-plane-shell`

褰撳墠鎷撴墤鏋勫缓椤哄簭鏄細

1. `contracts`
2. `runtime-core`
3. `compact-context-core`
4. `openclaw-adapter`
5. `control-plane-shell`
6. `compact-context`
7. `control-plane`

鍙互鐩存帴閫氳繃涓嬮潰鍛戒护鏌ョ湅褰撳墠鍥惧拰椤哄簭锛?
```powershell
npm run describe:workspace:graph
```

## 褰撳墠绛栫暐

褰撳墠骞舵病鏈夋妸鏁翠粨鐩存帴鍒囧埌 `tsc -b`锛岃€屾槸閲囩敤浜嗘洿淇濆畧浣嗗凡缁忕ǔ瀹氱殑缁勫悎绛栫暐锛?
- `run-workspace-plan.mjs`
  - 璐熻矗鎸変緷璧栭棴鍖呭拰鎷撴墤椤哄簭鎵ц `build:self / check:self`
- `run-current-workspace-plan.mjs`
  - 璁╂瘡涓?workspace 鑷繁鐨?`build / check` 涔熻蛋缁熶竴鍥撅紝鑰屼笉鏄墜鍐欎緷璧栭摼
- `workspace-tsc-task.mjs`
  - 璐熻矗鍗?workspace 鐨?`tsc` 璋冪敤鍜屾湰鍦?`dist` 娓呯悊
- `repo-tsc-task.mjs`
  - 璐熻矗 repo 绾?`dist` 鏋勫缓锛屾湇鍔′簬 `tests`銆乣evaluation` 鍜屽皯閲?repo-internal 楠屾敹
- `pack-workspaces.mjs`
  - 鍙牎楠岀幇鏈変骇鐗╁拰 manifest 璺緞锛屼笉閫氳繃 `prepack` 鍙嶅瑙﹀彂閲嶇紪
- `run-compiled-tests.mjs`
  - 浣跨敤 run-scoped 涓存椂鐩綍锛岄伩鍏?app / smoke 娴嬭瘯鍏变韩 `dist-smoke`
- `run-locked-npm-script.mjs` + `lock-utils.mjs`
  - 鐢?`workspace-artifacts` 鍜?per-workspace 閿侀伩鍏嶅叡浜骇鐗╁苟鍙戜簰鍒?
## 涓轰粈涔堢幇鍦ㄥ厛涓嶅紩鍏?`tsc -b`

褰撳墠璇勪及缁撴灉鏄細`鍏堜笉寮曞叆`銆?
鍘熷洜涓昏鏈?4 鐐癸細

1. `repo` 閲屼粛鐒跺悓鏃跺瓨鍦ㄤ袱濂楁瀯寤洪潰
- workspace 鍖呬笌 app 宸茬粡澶т綋 package-local 鍖?- 浣?repo 绾?`tests`銆乣internal/evaluation` 浠嶄緷璧?root `tsconfig.json -> dist`
- 杩欐剰鍛崇潃鍗充娇寮曞叆 project references锛屼篃杩橀渶瑕佷繚鐣欎竴濂?repo-level 缂栬瘧閾?
2. `contracts` 浠嶇劧涓嶆槸瀹屽叏 package-local
- [packages/contracts/tsconfig.json](/d:/C_Project/openclaw_compact_context/packages/contracts/tsconfig.json) 鐩墠浠嶇洿鎺ユ寚鍚?root `src/contracts/index.ts`
- 鍦ㄨ繖涓姸鎬佷笅涓?`tsc -b`锛屼細鎶娾€滆繕娌℃渶缁堢ǔ瀹氱殑婧愮爜褰掑睘鈥濊繘涓€姝ュ浐鍖栨垚鏋勫缓鍗忚

3. 鐜板湪鐨勭棝鐐逛富瑕佹槸鈥滈噸澶嶇紪璇戝拰骞跺彂浜掕俯鈥濓紝涓嶆槸鈥滅己灏戠紪璇戝櫒绾т緷璧栧浘鈥?- 渚濊禆鍥炬湰韬凡缁忚 `workspace-metadata.mjs + run-workspace-plan.mjs` 鏄惧紡寤哄嚭鏉ヤ簡
- 鐪熸褰卞搷浣撻獙鐨勬槸锛?  - 鍚屼竴鏉￠摼鍙嶅 build
  - 澶氫釜椤跺眰鍛戒护娓呯悊鍚屼竴涓?`dist`
  - smoke/test 澶嶇敤鍥哄畾涓存椂鐩綍
- 杩欎簺闂宸茬粡閫氳繃鏄惧紡鎷撴墤缂栨帓銆佺幇鏈変骇鐗╂牎楠屻€侀攣鍜?run-scoped 杈撳嚭鐩綍瑙ｅ喅浜嗕竴杞?
4. 鐜板湪缁х画鎺ㄨ繘 `tsc -b` 鐨勮竟闄呮敹鐩婅繕涓嶅楂?- 寮曞叆 `composite`銆乣.tsbuildinfo`銆乺eferences 涔嬪悗锛岄渶瑕侀噸鏂版暣鐞嗭細
  - root `tsconfig`
  - repo-level tests/evaluation
  - package 闂寸被鍨嬪彲瑙佹€?  - app/package/repo 涓夊眰缂栬瘧鑱岃矗
- 鍦?`TODO 7/8` 鐨?compat 鏀剁缉鍜?`src` 闀挎湡褰掑睘娌″畬鍏ㄥ畾涓嬫潵涔嬪墠锛岃繖浼氳鏋勫缓鍗忚鍙樺緱鏇村兊纭?
## 褰撳墠缁撹

褰撳墠闃舵鐨勭粨璁烘槸锛?
- `鍏堜繚鐣欐樉寮忚剼鏈紪鎺掞紝涓嶅垏 `tsc -b``
- 缁х画鎶?workspace 鐨?`build / check / test / pack` 鑱岃矗鏀跺洖鍒板悇鑷?package/app
- root 鍙繚鐣?orchestration 鍜?repo-level 楠屾敹

## 浣曟椂閲嶆柊璇勪及 `tsc -b`

鍚庨潰婊¤冻杩欎簺鏉′欢鏃讹紝鍐嶉噸鏂拌瘎浼?project references 鏇村悎閫傦細

- `src/*` compat 灞傜户缁缉鎺変竴杞?- `contracts` 鐪熸 package-local 鍖?- repo-level `tests / evaluation` 涓?workspace 绾ф瀯寤鸿竟鐣岃繘涓€姝ョǔ瀹?- root `tsconfig` 涓嶅啀鎵挎媴杩囧 workspace 鍐呴儴鑱岃矗

鍒伴偅鏃讹紝濡傛灉鐩爣鍙樻垚锛?
- 鏇村己鐨勫閲忕紦瀛?- 鏇存爣鍑嗙殑 editor/build graph
- 鏇存寮忕殑澶氫粨鍓嶇紪璇戝崗璁?
鍐嶄笂 `tsc -b` 浼氭洿鍒掔畻銆?




