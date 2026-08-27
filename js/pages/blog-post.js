// Trang chi tiết bài viết
import { $, escapeHtml, getParam } from '../core/utils.js';
import { POSTS } from './blog-data.js';

export default function init() {
  const el = $('#post-article');
  const slug = getParam('id');
  const post = POSTS.find(p => p.slug === slug) || POSTS[0];

  document.title = `${post.title} | Coffee Home`;

  el.innerHTML = `
    <div class="post-meta" style="font-size:.9rem">
      <span><i class="fa-regular fa-calendar"></i>${new Date(post.date).toLocaleDateString('vi-VN')}</span>
      <span><i class="fa-regular fa-user"></i>${escapeHtml(post.author)}</span>
      <span><i class="fa-regular fa-clock"></i>${post.readMin} phút đọc</span>
    </div>
    <h1>${escapeHtml(post.title)}</h1>
    <img class="article-cover" src="${post.image}" alt="">
    <div class="post-body-lg">${post.content}</div>
  `;

  // bài liên quan (khác bài hiện tại)
  const related = POSTS.filter(p => p.slug !== post.slug).slice(0, 3);
  $('#related-posts').innerHTML = related.map(p => `
    <article class="post-card">
      <img class="pc-cover" src="${p.image}" alt="" loading="lazy">
      <div class="post-body">
        <div class="post-meta">
          <span><i class="fa-regular fa-calendar"></i>${new Date(p.date).toLocaleDateString('vi-VN')}</span>
        </div>
        <h3>${escapeHtml(p.title)}</h3>
        <a class="read-more" href="/pages/blog-post.html?id=${p.slug}">Đọc tiếp <i class="fa-solid fa-arrow-right-long"></i></a>
      </div>
    </article>`).join('');
}
