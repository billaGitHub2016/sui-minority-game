import { Theme } from '@radix-ui/themes'
import { FC, PropsWithChildren } from 'react'

const ThemeProvider: FC<PropsWithChildren> = ({ children }) => {
  return (
    <Theme 
      appearance="dark" 
      accentColor="grass" 
      grayColor="slate" 
      radius="medium"
      className="w-full bg-black text-white"
    >
      {children}
    </Theme>
  )
}

export default ThemeProvider
