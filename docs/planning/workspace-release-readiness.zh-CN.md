# Workspace 鍙戝竷灏辩华涓庡浠撳噯澶?
杩欎唤鏂囨。瀵瑰簲 [post-split-cleanup-todo.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/post-split-cleanup-todo.zh-CN.md) 鐨?`TODO 9`锛岀洰鏍囨槸鎶娾€滃綋鍓?workspace 鏄惁宸茬粡鍏峰鐙珛鍙戝竷鍗曞厓 / 澶氫粨鍑嗗鏉′欢鈥濇敹鎴愪竴浠藉浐瀹氬彛寰勩€?
鐩稿叧鏂囨。锛?
- [workspace-release-audit-matrix.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-release-audit-matrix.zh-CN.md)
- [project-split-compatibility-note.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/project-split-compatibility-note.zh-CN.md)
- [workspace-test-and-release-boundary.zh-CN.md](/d:/C_Project/openclaw_compact_context/docs/planning/workspace-test-and-release-boundary.zh-CN.md)

## 1. 褰撳墠鎬诲垽鏂?
褰撳墠浠撳簱宸茬粡鍏峰锛?
- `workspace-first` 鐨勭ǔ瀹?build / check / pack / smoke 閾?- app / package / root smoke 鐨勮亴璐ｈ竟鐣?- 鍏变韩鏍稿績涓庡３灞傜殑娓呮櫚鎷嗗垎

浣嗚繕娌℃湁鍒扳€滅幇鍦ㄥ氨搴旇鎷嗗浠撯€濈殑闃舵銆?
鏇村噯纭殑鍒ゆ柇鏄細

`褰撳墠宸茬粡瀹屾垚鈥滅嫭绔嬪彂甯冨噯澶団€濓紝浣嗕粛澶勪簬 monorepo-first 闃舵銆俙

## 2. 姣忎釜 workspace 鐨勫彂甯冧笌澶氫粨鍒ゆ柇

| Workspace | 褰撳墠瑙掕壊 | 鏄惁閫傚悎鐙珛鍙戝竷 | 鏄惁寤鸿鐜板湪鐙珛浠撳簱鍖?| 鍒ゆ柇 |
| --- | --- | --- | --- | --- |
| `contracts` | shared foundation | 鏈潵鍙嫭绔?| 鏆備笉寤鸿 | API 闈㈠凡缁忓皬锛屾湭鏉ヨ嫢鍑虹幇澶栭儴娑堣垂鑺傚锛屽彲浼樺厛鐙珛锛涘綋鍓嶅厛缁х画閿佹銆?|
| `runtime-core` | shared foundation | 鏈潵鍙嫭绔?| 鏆備笉寤鸿 | 鏄渶鎺ヨ繎鐙珛鏍稿績搴撶殑鍗曞厓锛屼絾褰撳墠浠嶄笌 adapter / apps 寮哄崗鍚屻€?|
| `control-plane-core` | platform foundation | monorepo 鍐呭彂甯?| 涓嶅缓璁?| 涓昏鏈嶅姟骞冲彴鍐呴儴澹冲眰锛屽閮ㄦ秷璐归潰杩樹笉澶熺ǔ瀹氥€?|
| `openclaw-adapter` | host adapter | 鏈潵鍙嫭绔?| 鏆備笉寤鸿 | 杈圭晫娓呮锛屾湭鏉ュ彲鑳戒綔涓哄涓婚€傞厤搴撶嫭绔嬶紱褰撳墠浠嶄緷璧?runtime-core 鍚屾婕旇繘銆?|
| `control-plane-shell` | platform shell | monorepo 鍐呭彂甯?| 涓嶅缓璁?| 鏇村儚骞冲彴鍐呴儴澹冲眰锛岃€屼笉鏄暱鏈熺嫭绔嬪澶栧簱銆?|
| `compact-context` | runtime app shell | 鍙嫭绔嬩氦浠?| 涓嶅缓璁崟鐙粨搴?| 瀹冩槸鍙繍琛?app锛屼笉鏄叡浜簱锛涢€傚悎閮ㄧ讲/瀹夎锛屼笉閫傚悎鍏堟媶浠撱€?|
| `control-plane` | platform app shell | 鍙嫭绔嬩氦浠?| 涓嶅缓璁崟鐙粨搴?| 鍚屼笂锛屾洿閫傚悎浣滀负閮ㄧ讲澹宠€岄潪澶氫粨鏍稿績銆?|

## 3. 褰撳墠鐗堟湰鑱斿姩绛栫暐

褰撳墠寤鸿缁х画浣跨敤锛?
`lockstep release train`

涔熷氨鏄細

- 鎵€鏈?`@openclaw-compact-context/*` workspace 褰撳墠淇濇寔鍚屼竴鐗堟湰鍒楄溅
- 鍙戝竷銆乻moke銆乸ack 瀹¤浠嶆寜 monorepo 缁熶竴鎵ц

### 3.1 搴旇閿佹鐗堟湰鐨勫崟鍏?
褰撳墠寤鸿鍏ㄩ儴閿佹锛?
- `@openclaw-compact-context/contracts`
- `@openclaw-compact-context/runtime-core`
- `@openclaw-compact-context/control-plane-core`
- `@openclaw-compact-context/openclaw-adapter`
- `@openclaw-compact-context/control-plane-shell`
- `@openclaw-compact-context/compact-context`
- `@openclaw-compact-context/control-plane`

### 3.2 鏈潵鏈€鏈夋満浼氱嫭绔嬫紨杩涚殑鍊欓€?
濡傛灉鍚庨潰闇€瑕佹媶鍑虹嫭绔嬬増鏈妭濂忥紝浼樺厛鍊欓€夋槸锛?
- `contracts`
- `runtime-core`
- `openclaw-adapter`

鍘熷洜鏄細

- 瀹冧滑鏈€鎺ヨ繎娓呮櫚鐨勫叕鍏卞寘杈圭晫
- 宸茬粡鏈夌浉瀵圭ǔ瀹氱殑 exports / pack 琛ㄩ潰
- 灏嗘潵鏇村彲鑳借澶栭儴娑堣垂鑰呯洿鎺ヤ緷璧?
### 3.3 浠€涔堟椂鍊欏繀椤昏ˉ breaking change migration note

浠ヤ笅鎯呭喌蹇呴』琛ヨ縼绉昏鏄庯細

- 鍏叡 package 鐨?`exports / main / types / bin / openclaw.extensions` 鍙戠敓 breaking change
- 鎺ㄨ崘鍏ュ彛浠庝竴涓?workspace 鍖呰縼绉诲埌鍙︿竴涓?workspace 鍖?- `compat src/*` 鍏ュ彛琚垹闄ゆ垨鍋滄鏀寔
- 鏌愪釜 workspace 浠?`monorepo-first` 杞垚鈥滅嫭绔嬪彂甯冨€欓€夆€?
## 4. Release automation 璇勪及

褰撳墠涓嶆€ョ潃涓婂畬鏁?release automation / changelog / tag 绛栫暐銆?
鍘熷洜鏄細

- 鐩墠鐗堟湰浠嶉攣姝?- compat 鏀跺熬鍒氬埌鈥滃彲鎺р€濈姸鎬?- 鍏堟妸鍙戝竷杈圭晫鍜屾秷璐硅€呰縼绉昏矾寰勫啓姝伙紝鏀剁泭鏇撮珮

褰撳墠鏇寸ǔ鐨勬ā寮忔槸锛?
- 缁х画浣跨敤 `build/check/pack/smoke` 鐨勬樉寮忕紪鎺?- 鐢?`pack:workspace` 鍋?manifest + 浜х墿瀹¤
- 鐢?`required smoke / release smoke` 鍋氭暣浣撻獙鏀?
### 4.1 浠€涔堟椂鍊欏啀寮曞叆鑷姩鍖?
鍚庣画濡傛灉鍑虹幇涓嬮潰浠讳竴鏉′欢锛屽氨鍊煎緱寮€濮嬭瘎浼帮細

- 鑷冲皯涓€涓?shared package 寮€濮嬫寜鐙珛鑺傚鍙戝竷
- 闇€瑕佽嚜鍔ㄧ敓鎴?changelog / migration note
- 闇€瑕?apps 涓?packages 鍒嗗埆鎵?tag 鎴栫淮鎶ゅ鏉″彂甯冨垪杞?
閭ｆ椂浼樺厛鑰冭檻锛?
- `changesets`
- 鎴栫瓑浠风殑 monorepo release 宸ュ叿

## 5. 澶氫粨鍓嶉獙鏀跺熀绾?
鍦ㄧ湡姝ｈ€冭檻澶氫粨鍓嶏紝鍏堣揪鍒拌繖鏉″熀绾匡細

1. 姣忎釜 workspace 閮借兘鐙珛 `build / check / explain`
2. 鎵€鏈?publishable workspace 閮借兘閫氳繃 `pack:workspace` dry-run 瀹¤
3. `package / app / root smoke` 涓夊眰娴嬭瘯璐ｄ换鍥哄畾锛屼笉鍐嶄緷璧?root compat 鍋囪
4. 娑堣垂鑰呰縼绉昏矾寰勫拰 breaking change 瑙勫垯閮藉凡缁忔枃妗ｅ寲
5. 鍝簺缁х画閿佹銆佸摢浜涗互鍚庡彲鑳界嫭绔嬫紨杩涳紝宸茬粡鍐欐垚鍥哄畾鍙ｅ緞

## 6. 涓€鍙ヨ瘽缁撹

`鎴戜滑鐜板湪宸茬粡鍏峰鐙珛鍙戝竷鍑嗗锛屼絾杩樹笉寤鸿椹笂鎷嗗浠擄紱涓嬩竴闃舵鏇撮€傚悎缁х画淇濇寔 monorepo-first锛屽苟璁?contracts / runtime-core / openclaw-adapter 鎴愪负鏈潵鐙珛鍙戝竷鍊欓€夈€俙

## 7. 鐪熷疄鎵撳寘鐩綍绾﹀畾

鐪熷疄鐢熶骇鎵撳寘鐜板湪鍙繚鐣欎袱涓寮忎氦浠樼墿锛?
- `compact-context`
- `control-plane`

褰撳墠鍛戒护绾﹀畾锛?- `npm run pack:release`
  - 椤哄簭鐢熸垚涓や釜鏈€缁堜氦浠樺寘
  - 浜х墿鍒嗗埆钀藉埌 `artifacts/releases/compact-context/` 鍜?`artifacts/releases/control-plane/`
- `npm run pack:release:plugin`
  - 鍙敓鎴?`artifacts/releases/compact-context/*.tgz`
- `npm run pack:release:control-plane`
  - 鍙敓鎴?`artifacts/releases/control-plane/*.tgz`

鍥哄畾鐩綍鏄犲皠濡備笅锛?- `@openclaw-compact-context/compact-context` -> `artifacts/releases/compact-context/`
- `@openclaw-compact-context/control-plane` -> `artifacts/releases/control-plane/`

杩欎袱涓?app release 鍖呭綋鍓嶆寜 standalone 鏂瑰紡鐢熸垚锛?
- release 鎵撳寘鏃朵細鎶婂唴閮?workspace 渚濊禆涓€璧峰甫杩涙渶缁?`.tgz`
- 鏈€缁堝畨瑁呮椂涓嶅啀瑕佹眰棰濆浠?npm registry 鎷夊彇 `@openclaw-compact-context/*` 鍐呴儴鍖?- release 涓撶敤 manifest 涔熶細鎶婂伐浣滃尯鍐呯殑 `src/*` 绫诲瀷/鍏ュ彛璺緞鏀瑰啓鎴愭寮忓彲鍙戝竷鐨?`dist/*` 璺緞

鍏变韩 packages 缁х画閫氳繃 `npm run pack:workspace` 鍋?dry-run 瀹¤锛屼絾涓嶅啀浣滀负鐪熷疄鐢熶骇浜や粯鍖呭崟鐙敓鎴?`.tgz` 鍙戝竷鐩綍銆?
## 8. 褰撳墠鐪熷疄瀹夎楠岃瘉涓庡凡纭缁撹

杩欓儴鍒嗕笓闂ㄨ褰曞綋鍓嶈繖杞凡缁忓疄闄呴獙璇佽繃銆佷笉鑳藉彧鍋滅暀鍦ㄨ亰澶╅噷鐨?release 缁撹銆?
### 8.1 褰撳墠 app release 鍖呭凡缁忔槸 standalone 鍖?
褰撳墠涓や釜姝ｅ紡浜や粯鍖咃細

- `compact-context`
- `control-plane`

閮戒笉鍐嶅彧鏄€渁pp 澹?+ 澶栭儴 workspace 渚濊禆澹版槑鈥濓紝鑰屾槸锛?
- release 鎵撳寘鏃朵細鎶婂唴閮?`@openclaw-compact-context/*` workspace 渚濊禆涓€璧峰甫杩涙渶缁?`.tgz`
- 鏈€缁堝畨瑁呮椂涓嶅啀瑕佹眰棰濆浠?npm registry 鎷夎繖浜涘唴閮ㄥ寘

褰撳墠瀹炵幇鏂瑰紡鏄細

- release 鎵撳寘鏃跺厛鐢熸垚 standalone staging 鐩綍
- 涓?app 鐢熸垚 release 涓撶敤 manifest
- 鎶婂唴閮?workspace 渚濊禆涓€骞舵斁鍏ユ渶缁堝寘鍐呯殑 `node_modules`

### 8.2 release 涓撶敤 manifest 浼氭妸宸ヤ綔鍖鸿矾寰勬敼鍐欐垚姝ｅ紡鍙戝竷璺緞

褰撳墠宸茬粡纭锛宎pp release 鍖呭湪姝ｅ紡浜や粯鏃朵笉浼氬啀淇濈暀宸ヤ綔鍖哄唴閮ㄤ笓鐢ㄨ矾寰勶紝渚嬪锛?
- `openclaw.extensions: ./src/index.ts`
- `exports.types: ./src/...`

鑰屾槸浼氳嚜鍔ㄦ敼鍐欎负姝ｅ紡鍙戝竷鍙敤鐨勶細

- `./dist/index.js`
- `./dist/*.d.ts`

杩欎竴姝ユ槸蹇呴』鐨勶紝鍚﹀垯鈥滃寘铏界劧鑳芥墦鍑烘潵锛屼絾瀹夎鍚庝粛鐒朵笉鏄寮忓彲杩愯鍏ュ彛鈥濄€?
### 8.3 standalone 瀹夎宸茶鐪熷疄楠岃瘉

杩欒疆宸茬粡瀹為檯鍋氳繃涓ょ被楠岃瘉锛?
1. 鎻掍欢鍖呭畨瑁呭悗鐩存帴璋冪敤 CLI
2. 骞冲彴鍖呭畨瑁呭悗鐩存帴鍔犺浇涓诲叆鍙ｆā鍧?
鎻掍欢楠岃瘉缁撹锛?
- `openclaw-context-cli` 宸茬粡鍙互浠?release 瀹夎缁撴灉閲岀洿鎺ヨ繍琛?- 涓嶆槸鍙湪浠撳簱婧愮爜鐩綍鎴?`dist` 鐩綍閲屽彲鐢?- `summarize` 鍜?`roundtrip` 涓ょ被瀛愬懡浠ら兘宸茬粡鍋氳繃鐪熷疄瀹夎楠岃瘉
- `explain` 瀛愬懡浠や篃宸茬粡鍋氳繃鐪熷疄瀹夎楠岃瘉

骞冲彴楠岃瘉缁撹锛?
- `control-plane` release 鍖呭畨瑁呭悗锛屼富鍏ュ彛妯″潡鍙甯稿姞杞?
### 8.4 鍗曞寘 release 浼氭竻鐞嗛潪鐩爣 app 鐩綍

褰撳墠 release 鑴氭湰杩樻湁涓€涓噸瑕佽涓虹害瀹氾細

- `npm run pack:release:plugin`
  - 浼氬彧淇濈暀鎻掍欢鍖呯洰褰?- `npm run pack:release:control-plane`
  - 浼氬彧淇濈暀骞冲彴鍖呯洰褰?
涔熷氨鏄锛屽崟鍖?release 鍛戒护榛樿浼氭竻鐞嗗叾浠?app 鐨?release 鐩綍銆?
鍥犳锛?
- 濡傛灉浣犺鍚屾椂寰楀埌涓や釜鏈€缁堜氦浠樺寘锛屽簲璇ュ厛璺戯細
  - `npm run pack:release`
- 濡傛灉浣犲彧鎯抽噸鎵撲竴绉嶄氦浠樼墿锛屽啀璺戝搴斿崟鍖呭懡浠?
杩欎笉鏄?bug锛岃€屾槸褰撳墠鑴氭湰鐨勬槑纭涓恒€?
### 8.5 褰撳墠鏈€鎺ㄨ崘鐨勫畨瑁呴獙璇佹柟寮?
瀵硅繖涓や釜姝ｅ紡鍖咃紝褰撳墠鏈€绋崇殑鏈満楠岃瘉鏂瑰紡鏄細

- 鍏堣窇锛?  - `npm.cmd run pack:release`
- 鍐嶇敤鏈湴 prefix 瀹夎锛?  - `npm.cmd install -g --prefix <temp-dir> <tgz>`

杩欐牱鍙互鐩存帴楠岃瘉锛?
- 鍖呮槸鍚﹁嚜鍖呭惈
- bin 鏄惁鐪熺殑鍙墽琛?- 鍏ュ彛妯″潡鏄惁鐪熺殑鑳藉姞杞?


