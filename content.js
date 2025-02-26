  const urlParams = new URLSearchParams(window.location.search);
  const uuid = urlParams.get('uuid');
  console.log("当前页面的uuid：", uuid);

  const url = `https://tnlkuelk67.execute-api.us-east-1.amazonaws.com/tracker/${uuid}`;
  fetch(url)
  .then(response => {
  if (!response.ok) {
  throw new Error('网络请求错误');
}
  return response.json();
})
  .then(data => {
  console.log("当前页面的json：", data);
  displayReviewStatus(data);
})
  .catch(error => {
  console.error('获取JSON数据失败:', error);
});

  function displayReviewStatus(data) {
  // 创建容器
  const container = document.createElement('div');
  container.id = 'review-status-container';
  container.style.cssText = `
    position: fixed;
    top: 60px;
    right: 10px;
    width: 35vw;      /* 视口宽度 */
    min-width: 480px; /* 最小宽度480px */
    background-color: #f8f9fa;
    border: 1px solid #ccc;
    padding: 15px;
    z-index: 9999;
    max-height: 80vh;
    overflow-y: auto;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    border-radius: 4px;
    font-family: Arial, sans-serif;
    font-size: 14px;
    color: #333;
  `;
  container.style.display = 'block';

  // 标题
  const header = document.createElement('h2');
  header.textContent = 'Elsevier 审稿状态';
  header.style.cssText = `
    font-size: 18px;
    margin: 0 0 10px;
    text-align: center;
    border-bottom: 1px solid #ccc;
    padding-bottom: 8px;
  `;
  container.appendChild(header);

  // 顶部信息（稿件标题、期刊名、状态等）
  const infoList = document.createElement('ul');
  infoList.style.cssText = `
    margin: 0;
    padding: 0;
    list-style: none;
    margin-bottom: 10px;
  `;
  const fields = [
  'ManuscriptTitle',
  'JournalName',
  'Status',
  'SubmissionDate',
  'LatestRevisionNumber'
  ];
  fields.forEach(field => {
  if (data[field] !== undefined) {
  const li = document.createElement('li');
  li.style.marginBottom = '5px';
  let value = data[field];
  // 将时间戳字段精确到秒
  if (field === 'SubmissionDate' || field === 'LastUpdated') {
  const date = new Date(value * 1000);
  value = formatDateTime(date);
}
  li.textContent = `${field}: ${value}`;
  infoList.appendChild(li);
}
});
  container.appendChild(infoList);

  // 1. 将所有事件按 Revision 进行分组
  const revisionMap = {};
  data.ReviewEvents.forEach(evt => {
  const rev = evt.Revision;
  if (!revisionMap[rev]) {
  revisionMap[rev] = [];
}
  revisionMap[rev].push(evt);
});

  // 2. 按升序或降序排列所有 Revision
  const allRevisions = Object.keys(revisionMap)
  .map(x => Number(x))
  .sort((a, b) => a - b); // 升序

  // 最新修订号
  const latestRevision = data.LatestRevisionNumber;

  // 逐个版本生成折叠菜单
  allRevisions.forEach(rev => {
  // 每个版本的外层容器（含标题和内容区）
  const revisionContainer = document.createElement('div');
  revisionContainer.style.marginBottom = '10px';

  // 标题（点击可展开/折叠）
  const revHeader = document.createElement('div');
  revHeader.textContent = `Revision ${rev}`;
  revHeader.style.cssText = `
      font-size: 16px;
      font-weight: bold;
      margin: 10px 0;
      padding: 8px;
      border: 1px solid #ddd;
      background-color: #f1f1f1;
      cursor: pointer;
    `;
  revisionContainer.appendChild(revHeader);

  // 内容区：默认只展开最新修订
  const contentDiv = document.createElement('div');
  contentDiv.style.cssText = `
      border: 1px solid #ddd;
      border-top: none;
      padding: 10px;
    `;
  if (rev === latestRevision) {
  contentDiv.style.display = 'block';  // 默认展开
} else {
  contentDiv.style.display = 'none';   // 默认折叠
}

  // 点击标题切换展开/折叠
  revHeader.addEventListener('click', () => {
  contentDiv.style.display =
  (contentDiv.style.display === 'none') ? 'block' : 'none';
});

  // 3. 分析本修订版本下的审稿事件，统计各 reviewer 的状态
  const events = revisionMap[rev];
  if (!events || !events.length) {
  const noData = document.createElement('p');
  noData.textContent = '该修订阶段暂无审稿事件。';
  contentDiv.appendChild(noData);
} else {
  // 收集 reviewer 各事件时间
  const reviewersMap = {};
  events.forEach(event => {
  const rId = event.Id;
  if (!reviewersMap[rId]) {
  reviewersMap[rId] = {
  invitedDate: null,
  acceptedDate: null,
  completedDate: null
};
}
  const eventDate = new Date(event.Date * 1000);
  if (event.Event === 'REVIEWER_INVITED') {
  reviewersMap[rId].invitedDate ||= eventDate;
} else if (event.Event === 'REVIEWER_ACCEPTED') {
  reviewersMap[rId].acceptedDate ||= eventDate;
} else if (event.Event === 'REVIEWER_COMPLETED') {
  reviewersMap[rId].completedDate ||= eventDate;
}
});

  // 排序 reviewer Id，确保展示顺序一致
  const sortedReviewerIds = Object.keys(reviewersMap).sort((a, b) => Number(a) - Number(b));

  // 逐个 reviewer 生成卡片
  sortedReviewerIds.forEach((rId, idx) => {
  const {invitedDate, acceptedDate, completedDate} = reviewersMap[rId];
  const now = new Date();

  // 计算 responseTime, reviewTime
  const responseTimeDays = invitedDate ? diffInDays(invitedDate, acceptedDate || now) : '';
  let reviewTimeDays = '';
  if (acceptedDate) {
  reviewTimeDays = diffInDays(acceptedDate, completedDate || now);
}

  // 计算状态
  let status = 'Invited';
  if (acceptedDate && !completedDate) {
  status = 'In Review';
} else if (completedDate) {
  status = 'Completed';
}

  // 卡片DOM
  const card = document.createElement('div');
  card.style.cssText = `
          background-color: #fff;
          border: 1px solid #eee;
          border-radius: 6px;
          padding: 16px;
          margin-bottom: 12px;
          box-shadow: 0 1px 2px rgba(0,0,0,0.05);
          display: flex;
          align-items: center;
          justify-content: space-between;
        `;

  // 左侧
  const leftCol = document.createElement('div');
  leftCol.style.cssText = `
          display: flex;
          flex-direction: column;
          justify-content: center;
          min-width: 120px;
        `;
  const reviewerTitle = document.createElement('div');
  reviewerTitle.textContent = `Reviewer #${idx + 1}`;
  reviewerTitle.style.cssText = `
          font-size: 15px;
          font-weight: bold;
          margin-bottom: 8px;
        `;
  leftCol.appendChild(reviewerTitle);

  const invitedLine = document.createElement('div');
  invitedLine.textContent = `Invited: ${formatDateTime(invitedDate)}`;
  invitedLine.style.marginBottom = '4px';
  leftCol.appendChild(invitedLine);

  const acceptedLine = document.createElement('div');
  acceptedLine.textContent = `Accepted: ${formatDateTime(acceptedDate)}`;
  acceptedLine.style.marginBottom = '4px';
  leftCol.appendChild(acceptedLine);

  const completedLine = document.createElement('div');
  completedLine.textContent = `Completed: ${formatDateTime(completedDate)}`;
  leftCol.appendChild(completedLine);

  card.appendChild(leftCol);

  // 中列1 - Response Time
  const middleCol1 = document.createElement('div');
  middleCol1.style.cssText = `
          text-align: center;
          flex: 1;
        `;
  const responseLabel = document.createElement('div');
  responseLabel.textContent = 'Response Time';
  responseLabel.style.cssText = 'color: #6c757d; margin-bottom: 6px; font-size: 13px;';
  middleCol1.appendChild(responseLabel);

  const responseValue = document.createElement('div');
  responseValue.textContent = (responseTimeDays !== '') ? `${responseTimeDays} days` : '--';
  responseValue.style.cssText = `
          font-weight: bold;
          font-size: 16px;
        `;
  middleCol1.appendChild(responseValue);
  card.appendChild(middleCol1);

  // 中列2 - Review Time
  const middleCol2 = document.createElement('div');
  middleCol2.style.cssText = `
          text-align: center;
          flex: 1;
        `;
  const reviewLabel = document.createElement('div');
  reviewLabel.textContent = 'Review Time';
  reviewLabel.style.cssText = 'color: #6c757d; margin-bottom: 6px; font-size: 13px;';
  middleCol2.appendChild(reviewLabel);

  const reviewValue = document.createElement('div');
  if (!acceptedDate) {
  reviewValue.textContent = '--';
} else {
  reviewValue.textContent = (reviewTimeDays !== '') ? `${reviewTimeDays} days` : 'In Progress';
}
  reviewValue.style.cssText = `
          font-weight: bold;
          font-size: 16px;
        `;
  middleCol2.appendChild(reviewValue);
  card.appendChild(middleCol2);

  // 右侧 - Status
  const rightCol = document.createElement('div');
  rightCol.style.cssText = `
          text-align: right;
          min-width: 70px;
        `;
  const statusLabel = document.createElement('div');
  statusLabel.textContent = 'Status';
  statusLabel.style.cssText = 'color: #6c757d; margin-bottom: 6px; font-size: 13px;';
  rightCol.appendChild(statusLabel);

  const statusValue = document.createElement('div');
  statusValue.textContent = status;
  if (status === 'Completed') {
  statusValue.style.color = '#28a745';
} else if (status === 'In Review') {
  statusValue.style.color = '#0d6efd';
} else {
  statusValue.style.color = '#6c757d';
}
  statusValue.style.cssText += `
          font-weight: bold;
          font-size: 16px;
        `;
  rightCol.appendChild(statusValue);
  card.appendChild(rightCol);

  contentDiv.appendChild(card);
});
}

  // 把内容区加入版本容器，再加到总容器
  revisionContainer.appendChild(contentDiv);
  container.appendChild(revisionContainer);
});

  // 添加到页面，并创建“显示/隐藏审稿状态”按钮
  document.body.appendChild(container);
  createToggleButton(container);
}

  /** 工具函数：格式化日期到秒 */
  function formatDateTime(dateObj) {
  if (!dateObj || isNaN(dateObj)) return '';
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  const hh = String(dateObj.getHours()).padStart(2, '0');
  const mm = String(dateObj.getMinutes()).padStart(2, '0');
  const ss = String(dateObj.getSeconds()).padStart(2, '0');
  return `${y}/${m}/${d} ${hh}:${mm}:${ss}`;
}

  /** 工具函数：计算两个日期之间的天数 */
  function diffInDays(d1, d2) {
  if (!d1 || !d2) return '';
  const msInOneDay = 24 * 60 * 60 * 1000;
  return Math.round((d2 - d1) / msInOneDay);
}

  /** 创建“显示/隐藏审稿状态”按钮 */
  function createToggleButton(container) {
  const toggleButton = document.createElement('button');
  toggleButton.id = 'toggle-button';
  toggleButton.textContent = '显示/隐藏审稿状态';
  toggleButton.style.cssText = `
    position: fixed;
    top: 10px;
    right: 10px;
    z-index: 10000;
    padding: 8px 12px;
    border: none;
    background-color: #007BFF;
    color: #fff;
    border-radius: 4px;
    font-size: 14px;
    cursor: pointer;
    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
    transition: background-color 0.3s;
  `;
  toggleButton.addEventListener('mouseenter', () => {
  toggleButton.style.backgroundColor = '#0056b3';
});
  toggleButton.addEventListener('mouseleave', () => {
  toggleButton.style.backgroundColor = '#007BFF';
});
  document.body.appendChild(toggleButton);

  toggleButton.addEventListener('click', () => {
  container.style.display = (container.style.display === 'none') ? 'block' : 'none';
});
}

