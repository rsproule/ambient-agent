"use client"

import * as React from "react"
import { Loader } from "@/src/components/loader"
import { CodeBlock } from "@/src/components/code-block"
import {
  Sources,
  SourcesContent,
  SourcesTrigger,
  Source as SourcesItem,
} from "@/src/components/sources"
import { WebSearchToolInvocation } from "./tool"
import { cn } from "@/src/lib/utils"
import { Card, CardContent, CardHeader } from "@/src/components/ui/card"
import { Skeleton } from "@/src/components/ui/skeleton"

export function WebSearchList({
  invocation,
}: {
  invocation: WebSearchToolInvocation
}) {
  const part = invocation
  const cardBaseClass =
    "not-prose flex w-full flex-col gap-0 overflow-hidden border border-border/50 bg-background/95 py-0 text-foreground shadow-sm"
  const headerBaseClass =
    "flex flex-col gap-2 border-b border-border/50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
  const contentBaseClass = "px-6 py-5"
  const renderHeader = (
    title: React.ReactNode,
    description?: React.ReactNode,
    actions?: React.ReactNode
  ) => {
    const descriptionNode =
      typeof description === "string" ? (
        <p className="text-xs text-muted-foreground">{description}</p>
      ) : (
        (description ?? null)
      )

    return (
      <CardHeader className={headerBaseClass}>
        {(title || descriptionNode) && (
          <div className="space-y-1">
            {title ? (
              <h3 className="text-sm font-semibold leading-none tracking-tight text-foreground">
                {title}
              </h3>
            ) : null}
            {descriptionNode}
          </div>
        )}
        {actions ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {actions}
          </div>
        ) : null}
      </CardHeader>
    )
  }
  if (part.state === "input-streaming") {
    return (
      <Card className={cn(cardBaseClass, "max-w-xl animate-in fade-in-50")}>
        {renderHeader("Web Search", "Waiting for query…")}
        <CardContent
          className={cn(
            contentBaseClass,
            "space-y-4 text-sm text-muted-foreground"
          )}
        >
          <div className="flex items-center gap-2">
            <Loader /> Preparing search
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Skeleton key={idx} className="h-16 w-full rounded-xl" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (part.state === "input-available") {
    return (
      <Card className={cn(cardBaseClass, "max-w-xl animate-in fade-in-50")}>
        {renderHeader("Web Search", "Searching…")}
        <CardContent className={cn(contentBaseClass, "space-y-4")}>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader /> Running tool
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, idx) => (
              <Skeleton key={idx} className="h-16 w-full rounded-xl" />
            ))}
          </div>
          {part.input ? (
            <div className="rounded-md border border-border/40 bg-muted/40">
              <CodeBlock
                code={JSON.stringify(part.input, null, 2)}
                language="json"
              />
            </div>
          ) : null}
        </CardContent>
      </Card>
    )
  }

  if (part.state === "output-error") {
    return (
      <Card className={cn(cardBaseClass, "max-w-xl animate-in fade-in-50")}>
        {renderHeader("Web Search", "Error")}
        <CardContent className={contentBaseClass}>
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {part.errorText || "An error occurred while searching the web."}
          </div>
        </CardContent>
      </Card>
    )
  }
  if (part.output === undefined) return null
  
  // Tool returns raw Perplexity generateText result
  const output = part.output as { text?: string; sources?: Array<{ url: string; title?: string }> }
  const text = output.text || ""
  const sources = output.sources || []
  
  return (
    <Card className={cn(cardBaseClass, "max-w-xl animate-in fade-in-50")}>
      {renderHeader("Web Search")}
      <CardContent className={cn(contentBaseClass, "space-y-4")}>
        {text ? (
          <div className="text-sm text-foreground whitespace-pre-wrap">{text}</div>
        ) : (
          <div className="text-sm text-muted-foreground">No results.</div>
        )}

        {sources.length > 0 ? (
          <div className="mt-4">
            <Sources>
              <SourcesTrigger count={sources.length} />
              <SourcesContent>
                {sources.map((s, idx) => (
                  <SourcesItem
                    key={s.url || idx}
                    href={s.url}
                    title={s.title || s.url}
                  />
                ))}
              </SourcesContent>
            </Sources>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export default WebSearchList
