"use client"

import { ChakraProvider, defaultSystem } from "@chakra-ui/react"
import {
  ColorModeProvider,
  type ColorModeProviderProps,
} from "./color-mode"
import { Toaster } from "./toaster"
import * as React from "react"

export function Provider({ children, ...props }: React.PropsWithChildren<ColorModeProviderProps>) {
  return (
    <ChakraProvider value={defaultSystem}>
      <ColorModeProvider {...props} forcedTheme="dark">
        {children}
        <Toaster />
      </ColorModeProvider>
    </ChakraProvider>
  )
}
