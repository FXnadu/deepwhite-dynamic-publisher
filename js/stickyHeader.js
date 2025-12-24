// 固定头部功能
document.addEventListener('DOMContentLoaded', function() {
  const header = document.getElementById('mainHeader');
  const placeholder = document.querySelector('.header-placeholder');
  
  if (!header || !placeholder) {
    console.error('固定头部：找不到必要的元素', { header, placeholder });
    return;
  }
  
  console.log('固定头部功能已初始化');
  
  let headerHeight = 0;
  const triggerPoint = 80; // 滚动超过80px时触发
  
  // 获取头部高度
  function updateHeaderHeight() {
    headerHeight = header.offsetHeight;
    placeholder.style.height = headerHeight + 'px';
    console.log('头部高度:', headerHeight);
  }
  
  // 处理滚动事件
  function handleScroll() {
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    if (scrollTop > triggerPoint) {
      if (!header.classList.contains('sticky')) {
        console.log('添加固定样式，滚动位置:', scrollTop);
        header.classList.add('sticky');
        placeholder.classList.add('active');
      }
    } else {
      if (header.classList.contains('sticky')) {
        console.log('移除固定样式，滚动位置:', scrollTop);
        header.classList.remove('sticky');
        placeholder.classList.remove('active');
      }
    }
  }
  
  // 初始化
  updateHeaderHeight();
  window.addEventListener('resize', updateHeaderHeight);
  window.addEventListener('scroll', handleScroll, { passive: true });
  
  // 立即检查一次滚动位置
  handleScroll();
});
