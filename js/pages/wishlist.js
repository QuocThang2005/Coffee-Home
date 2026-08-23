// Món yêu thích
import { $ } from '../core/utils.js';
import { getMenu } from '../core/api.js';
import { wishlist } from '../core/store.js';
import { renderGrid, bindGridActions } from '../components/products.js';

export default async function init() {
  const menu = await getMenu();

  const render = () => {
    const ids = wishlist.get();
    const items = menu.products.filter(p => ids.includes(p.id));
    $('#wishlist-grid').innerHTML = '';
    if (!items.length) {
      $('#wishlist-grid').hidden = true;
      $('#wishlist-empty').hidden = false;
    } else {
      $('#wishlist-grid').hidden = false;
      $('#wishlist-empty').hidden = true;
      renderGrid($('#wishlist-grid'), items);
    }
  };

  window.addEventListener('wishlist:change', () => setTimeout(render, 0));
  bindGridActions($('#wishlist-grid'));
  render();
}
