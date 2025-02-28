
  // 1. 获取 URL 参数中的 uuid
  const urlParams = new URLSearchParams(window.location.search);
  const uuid = urlParams.get('uuid');
  console.log("当前页面的uuid：", uuid);

  // 2. 请求后端接口
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

  /**
   * 核心函数：生成并显示审稿状态面板
   */
  function displayReviewStatus(data) {
    // 创建容器
    const container = document.createElement('div');
    container.id = 'review-status-container';
    container.style.cssText = `
      position: fixed;
      top: 60px;
      right: 10px;
      width: 35vw;
      min-width: 480px;
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
      display: block;
    `;

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
        // 如果是时间戳字段，转成对应时区
        if (field === 'SubmissionDate' || field === 'LastUpdated') {
          const date = toUTC8DateFromUTC3(value);
          value = formatDateTime(date);
        }
        li.textContent = `${field}: ${value}`;
        infoList.appendChild(li);
      }
    });
    container.appendChild(infoList);

    // 拿到 ReviewEvents 并按 Revision 分组
    const revisionMap = {};
    if (Array.isArray(data.ReviewEvents)) {
      data.ReviewEvents.forEach(evt => {
        const rev = evt.Revision;
        if (!revisionMap[rev]) {
          revisionMap[rev] = [];
        }
        revisionMap[rev].push(evt);
      });
    }

    // 取出所有 revision，并按升序排列
    const allRevisions = Object.keys(revisionMap)
      .map(x => Number(x))
      .sort((a, b) => a - b);

    // 最新修订号
    const latestRevision = data.LatestRevisionNumber;

    // 遍历每个修订版本，生成折叠菜单
    allRevisions.forEach(rev => {
      // 每个版本的外层容器（含标题和内容区）
      const revisionContainer = document.createElement('div');
      revisionContainer.style.marginBottom = '10px';

      // 审稿事件
      const events = revisionMap[rev] || [];

      // 统计该修订下的各种事件次数（Completed / Accepted / Invited）
      const completedCount = events.filter(e => e.Event === 'REVIEWER_COMPLETED').length;
      const acceptedCount  = events.filter(e => e.Event === 'REVIEWER_ACCEPTED').length;
      const invitedCount   = events.filter(e => e.Event === 'REVIEWER_INVITED').length;

      // 标题（点击可展开/折叠），带上颜色和统计信息
      const revHeader = document.createElement('div');
      revHeader.innerHTML = `Revision ${rev} (
        <span style="color: #28a745;">Completed: ${completedCount}</span>,
        <span style="color: #0d6efd;">Accepted: ${acceptedCount}</span>,
        <span style="color: #6c757d;">Invited: ${invitedCount}</span>
      )`;
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
        contentDiv.style.display = 'block';
      } else {
        contentDiv.style.display = 'none';
      }

      // 点击标题切换展开/折叠
      revHeader.addEventListener('click', () => {
        contentDiv.style.display =
          (contentDiv.style.display === 'none') ? 'block' : 'none';
      });

      // 如果该修订没有审稿事件
      if (!events.length) {
        const noData = document.createElement('p');
        noData.textContent = '该修订阶段暂无审稿事件。';
        contentDiv.appendChild(noData);
      } else {
        // 按 Reviewer 分析事件
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
          // 把原本UTC+3 的时间戳，再加5小时变为 UTC+8
          const eventDate = toUTC8DateFromUTC3(event.Date);

          if (event.Event === 'REVIEWER_INVITED') {
            reviewersMap[rId].invitedDate ||= eventDate;
          } else if (event.Event === 'REVIEWER_ACCEPTED') {
            reviewersMap[rId].acceptedDate ||= eventDate;
          } else if (event.Event === 'REVIEWER_COMPLETED') {
            reviewersMap[rId].completedDate ||= eventDate;
          }
        });

        // 排序 reviewer Id
        const sortedReviewerIds = Object.keys(reviewersMap)
          .sort((a, b) => Number(a) - Number(b));

        // 逐个 reviewer 生成卡片
        sortedReviewerIds.forEach((rId, idx) => {
          const { invitedDate, acceptedDate, completedDate } = reviewersMap[rId];
          // 当前时间也做相同处理（UTC+3转到UTC+8）
          const now = new Date(new Date().getTime() + 5 * 3600 * 1000);

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

          // 左侧：Reviewer及邀请/接受/完成时间
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

          // 中列1：Response Time
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

          // 中列2：Review Time
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

          // 右侧：Status
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

          // 卡片加入 contentDiv
          contentDiv.appendChild(card);
        });
      }

      // 内容区加入修订容器，再放到总容器
      revisionContainer.appendChild(contentDiv);
      container.appendChild(revisionContainer);
    });

    // 将审稿状态容器加入页面
    document.body.appendChild(container);

    // 创建“显示/隐藏审稿状态”按钮
    createToggleButton(container);
  }

  /**
   * 将原本 UTC+3 的时间戳(秒)转换为 UTC+8 的 Date 对象
   */
  function toUTC8DateFromUTC3(timestampInSeconds) {
    if (!timestampInSeconds) return null;
    let d = new Date(timestampInSeconds * 1000);
    d = new Date(d.getTime() + 5 * 3600 * 1000);
    return d;
  }

  /**
   * 工具函数：格式化日期到秒（yyyy/mm/dd HH:MM:SS）
   */
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

  /**
   * 计算两个日期之间的天数，四舍五入
   */
  function diffInDays(d1, d2) {
    if (!d1 || !d2) return '';
    const msInOneDay = 24 * 60 * 60 * 1000;
    return Math.round((d2 - d1) / msInOneDay);
  }

  /**
   * 创建“显示/隐藏审稿状态”按钮
   */
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
