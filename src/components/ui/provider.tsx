"use client"

import { ChakraProvider, defaultSystem } from "@chakra-ui/react"
import {
  ColorModeProvider,
  type ColorModeProviderProps,
} from "./color-mode"
import * as React from "react"

export function Provider({ children, ...props }: React.PropsWithChildren<ColorModeProviderProps>) {
  return (
    <ChakraProvider value={defaultSystem}>
      <ColorModeProvider {...props} forcedTheme="dark">{children}</ColorModeProvider>
    </ChakraProvider>
  )
}
