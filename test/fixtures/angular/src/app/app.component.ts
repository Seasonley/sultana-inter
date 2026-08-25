import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  template: `<div>
    <h1>{{title}}</h1>
    <p>欢迎来到应用</p>
    <button>开始使用</button>
    <footer>版本信息</footer>
    <span>用户登录</span>
    <nav>导航菜单</nav>
  </div>`,
})
export class AppComponent {
  title = 'Angular App';
}
