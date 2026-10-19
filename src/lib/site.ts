export const site = {
  name: 'mustard-wiki',
  role: '笔记 · 实验 · 喜欢的东西',
  description: '记录自己的笔记, 实验和一些喜欢的东西.',
  introduction: '这里放着我的笔记, 做过的小实验, 还有一些喜欢的东西.',
};
export const demo = import.meta.env.PUBLIC_DEMO === true;
export const localPreview =
  !demo && import.meta.env.DEV && import.meta.env.PUBLIC_LOCAL_PREVIEW === true;
export function url(path = '/') {
  return `${import.meta.env.BASE_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
}
export const displayDate = (date: string) => date.replaceAll('-', '.');
export const statusLabels = {
  'in-progress': '制作中',
  completed: '已完成',
  paused: '暂时搁置',
};
