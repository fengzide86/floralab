(function () {
  'use strict';
  function open(topic = 'start') {
    const previous = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = 'usage-guide';
    dialog.setAttribute('aria-labelledby', 'guideTitle');
    dialog.innerHTML = `<header><div><span class="kicker">FloraLab · 使用说明</span><h2 id="guideTitle">从想法到成品，怎么走？</h2></div><button type="button" data-close-guide aria-label="关闭使用说明">关闭</button></header>
      <p class="guide-intro">FloraLab 把想法、设计事实和真实制作接起来。你可以先讨论再建方案，也可以直接在 Studio 开始一件作品。</p>
      <details><summary>先认识整个项目：创作空间、Studio 和文件</summary><p><strong>创作空间</strong>是你在 ChatGPT 中讨论作品的地方：描述想法、发参考图、探索审美、生成效果图、看制作照片。<strong>Studio</strong>是当前这个网页：记录材料、数量、预算、摆放、用料和成品。</p><p><strong>.floralab 文件</strong>把两边接起来。把 Studio 当前版本导出给创作空间，讨论和生图就有准确依据；讨论中确认了修改，再在 Studio 更新对应材料或结构。图片需要添加回作品。</p><p>网页里的“创作空间”按钮目前提供交接提示或复制摘要，不会自动打开、同步你的 ChatGPT 对话。两边不会自动知道彼此刚做了什么。</p></details>
      <details><summary>第一次用：照着做完一件小作品</summary><p>用“白绿桌花，不要玫瑰”开始 → 核对第一份方案 → 比较并选定一个方向 → 检查已有和还需买的材料 → 核对施工图 → 按步骤制作 → 添加实拍照片和体会 → 导出设计与图片。</p><p>想先看效果：在买材料前，把当前 .floralab 文件带到创作空间生成效果图，再回 Studio 添加。已经做好一半：从首页打开原作品，继续记录用量与照片，不必重新生成。</p></details>
      <details ${topic==='start'?'open':''}><summary>1. 写想法，核对第一份方案</summary><p>点首页“开始一件作品”，写一句想法，例如“做一件白绿桌花，不要玫瑰”。已确定的颜色、材料和数量也可以补充。点“整理想法，查看方案”。</p><p>填写时会自动把草稿保存在当前浏览器，请留意表单旁的保存状态。暂时离开后，可在首页点“继续草稿”；想另起一个想法，需要确认清除旧草稿。保存失败时先复制文字，避免刷新后丢失。</p><p>总览显示原文和识别结果。这是规则生成的起点，先核对材料、颜色、数量和形式；复杂气质与构图仍需要你判断。</p><p>浏览器的后退、前进可以返回刚才查看的页面；刷新会接回当前作品的工作区。页面地址只记录当前浏览器里的位置，不能用它把作品分享或同步到另一台设备；交接作品请导出 .floralab 文件。</p></details>
      <details><summary>2. 比较方向，选定制作方案</summary><p>在“想法与方案 → 比较方向”预览变化。保存备选会另建一份方案，原方案仍保留；选喜欢的一份作为制作方案。</p><p>“保持不变”约束自动生成的备选方向；手动修改材料或点位会更新当前方案。要保留旧状态，可在“成品与记录 → 修改与恢复”查看快照，或先导出文件。</p></details>
      <details><summary>3. 看材料清单，准备采购</summary><p>进入“材料与准备”，核对需要数量、已有数量和单价；空白单价表示待询价。替换材料或改数量后再看采购缺口。可以复制采购清单或打印。</p><p>材料库用于核对材料资料，不能代替实物确认。涉及供水、承重、宠物和运输的条件仍需按你的实际环境核实。</p></details>
      <details ${topic==='structure'?'open':''}><summary>4. 调整空间与摆放施工图</summary><p>进入“动手制作 → 摆放施工图”。总览里的摆放示意、效果图照片和制作步骤配图仅供查看，编辑位置要到这张施工图。</p><ol><li>用“选择材料点位”找到具体编号，或轻点花头圆点。编号在五个视图中指向同一枝。</li><li>按住圆点拖动；手机在图外上下滑动页面。拖动会移动这枝花头的位置，固定点不随它移动。</li><li>不方便拖动时，用“左右、前后、升降”按钮，每次移动 1 或 5 cm。</li><li>正面改左右与高度；左右侧面改前后与高度；俯视改左右与前后。背面和右侧的屏幕方向与正面、左侧相反。</li><li>点位显示“已锁定”时，先点“解锁点位”。展开“精细调整”可输入坐标、长度和角度。</li></ol><p>空间按钮按作品自身方向：右为 x 正向，前为 y 正向，上为 z 正向，与当前观察视角无关。花器底部中心是原点。位置会受作品尺寸范围限制；移动不会自动增加材料数量，也不是旋转整个场景的 3D 操作。</p><p>复制或删除点位会同时改变材料数量，请看清确认提示。图示表达制作关系，不保证毫米级精度。</p></details>
      <details><summary>5. 添加效果图，逐步制作</summary><p>“想法与方案 → 效果图”用于放入图片。把当前 .floralab 文件或效果图交接说明带到创作空间生成图片，再添加回来；网页本身不调用 AI 生图。</p><p>在“动手制作 → 制作步骤”勾选准备项，按步骤记录已用和损耗。最后点“完成检查，记录成品”。改过材料或结构后，旧效果图会提示需要核对。</p></details>
      <details><summary>6. 记录成品，保存与换设备</summary><p>在“成品与记录”添加实拍照片、耗时和体会，再保存成品记录；点“标记作品已完成”也会一并保存当前填写的反馈。比较轮廓、颜色、层次和材料差异，不用虚构还原率。</p><p><strong>作品和图片保存在当前浏览器，没有账号云同步。</strong>等页面显示“已保存在本机”。换设备或清理浏览器之前，点“导出设计与图片”保存 .floralab 文件；另一台设备在首页导入，导入会另建作品。</p><p>误改时到“修改与恢复”预览旧快照再恢复；恢复前也会保留当前状态。</p></details>
      <details><summary>遇到点不动、拖不动怎么办？</summary><p>先确认在“摆放施工图”，再检查点位是否锁定。密集的花头优先用点位列表选择；拖动困难时直接用空间按钮。若已到尺寸边界，继续向外移不会生效。</p><p>若保存失败，先保留当前内容并导出。同一件作品在其他标签页有更新时，这一页会提示冲突；先导出尚未保存的候选，再重新打开最新作品，避免覆盖刚保存的修改。</p><p>升级后旧页面不响应时，先复制尚未提交的文字，再联网刷新一次；不要为了刷新版本清除网站数据。</p></details>`;
    const close = () => { dialog.close(); dialog.remove(); previous?.focus(); };
    dialog.querySelector('[data-close-guide]').onclick=close;
    dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
    document.body.append(dialog); dialog.showModal(); dialog.querySelector('[data-close-guide]').focus();
    if (topic === 'structure') dialog.scrollTop = dialog.querySelector('details[open]').offsetTop - dialog.querySelector('header').offsetHeight - 12;
  }
  globalThis.FloraLabGuide = {open};
})();
