import './style.css';

export const metadata = {
  title: 'Fieldwork Studio · Workshop programme',
  description: 'Explore paper, print and textile workshops. Choose a studio session, reserve a seat and keep your ticket.',
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
