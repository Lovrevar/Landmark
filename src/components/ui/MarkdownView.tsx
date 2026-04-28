import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface Props {
  content: string
  className?: string
}

const MarkdownView: React.FC<Props> = ({ content, className }) => {
  return (
    <div className={`text-sm text-gray-800 dark:text-gray-100 leading-relaxed ${className || ''}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="text-lg font-bold mt-3 mb-1">{children}</h1>,
          h2: ({ children }) => <h2 className="text-base font-bold mt-3 mb-1">{children}</h2>,
          h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
          p: ({ children }) => <p className="my-1.5">{children}</p>,
          ul: ({ children }) => <ul className="list-disc pl-5 my-1.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal pl-5 my-1.5">{children}</ol>,
          li: ({ children }) => <li className="my-0.5">{children}</li>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="px-1 py-0.5 rounded text-xs bg-gray-100 dark:bg-gray-800 text-pink-700 dark:text-pink-300">
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre className="my-2 p-3 rounded bg-gray-100 dark:bg-gray-800 overflow-x-auto text-xs">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-3 italic text-gray-600 dark:text-gray-300 my-1.5">
              {children}
            </blockquote>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="min-w-full text-xs border border-gray-200 dark:border-gray-700">
                {children}
              </table>
            </div>
          ),
          th: ({ children }) => (
            <th className="px-2 py-1 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-left font-semibold">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-2 py-1 border border-gray-200 dark:border-gray-700">
              {children}
            </td>
          ),
          hr: () => <hr className="my-3 border-gray-200 dark:border-gray-700" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownView
