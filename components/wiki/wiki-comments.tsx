"use client"

import { useState } from 'react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MessageSquare, Reply, Pencil, Trash2 } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { useTranslations } from '@/components/language-provider'

interface CommentUser {
  id: string
  firstName: string
  lastName: string
  profileImage?: string | null
}

interface WikiCommentData {
  id: string
  content: string
  isEdited: boolean
  createdAt: string
  user: CommentUser
  replies?: WikiCommentData[]
}

interface WikiCommentsProps {
  comments: WikiCommentData[]
  currentUserId: string
  currentUserRole: string
  onAddComment: (content: string, parentId?: string) => Promise<void>
  onEditComment: (commentId: string, content: string) => Promise<void>
  onDeleteComment: (commentId: string) => Promise<void>
}

export function WikiComments({
  comments,
  currentUserId,
  currentUserRole,
  onAddComment,
  onEditComment,
  onDeleteComment,
}: WikiCommentsProps) {
  const [newComment, setNewComment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const t = useTranslations()

  const handleSubmit = async () => {
    if (!newComment.trim()) return
    setSubmitting(true)
    try {
      await onAddComment(newComment.trim())
      setNewComment('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="h-5 w-5" />
        <h3 className="text-lg font-semibold">{t.wiki?.comments || 'Comments'} ({comments.length})</h3>
      </div>

      {/* Add comment */}
      <div className="space-y-2">
        <Textarea
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder={t.wiki?.addComment || 'Add a comment...'}
          rows={3}
        />
        <Button onClick={handleSubmit} disabled={!newComment.trim() || submitting} size="sm">
          {submitting ? (t.common?.submitting || 'Submitting...') : (t.wiki?.postComment || 'Post Comment')}
        </Button>
      </div>

      {/* Comments list */}
      <div className="space-y-4">
        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            onReply={onAddComment}
            onEdit={onEditComment}
            onDelete={onDeleteComment}
          />
        ))}
        {comments.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-4">{t.wiki?.noComments || 'No comments yet. Be the first to comment!'}</p>
        )}
      </div>
    </div>
  )
}

function CommentItem({
  comment,
  currentUserId,
  currentUserRole,
  onReply,
  onEdit,
  onDelete,
  depth = 0,
}: {
  comment: WikiCommentData
  currentUserId: string
  currentUserRole: string
  onReply: (content: string, parentId?: string) => Promise<void>
  onEdit: (commentId: string, content: string) => Promise<void>
  onDelete: (commentId: string) => Promise<void>
  depth?: number
}) {
  const [replying, setReplying] = useState(false)
  const [editing, setEditing] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [editText, setEditText] = useState(comment.content)

  const isOwn = comment.user.id === currentUserId
  const canDelete = isOwn || currentUserRole === 'HR' || currentUserRole === 'ADMIN'
  const initials = `${comment.user.firstName[0]}${comment.user.lastName[0]}`

  const handleReply = async () => {
    if (!replyText.trim()) return
    await onReply(replyText.trim(), comment.id)
    setReplyText('')
    setReplying(false)
  }

  const handleEdit = async () => {
    if (!editText.trim()) return
    await onEdit(comment.id, editText.trim())
    setEditing(false)
  }

  return (
    <div className={depth > 0 ? 'ml-8 border-l-2 border-gray-100 pl-4' : ''}>
      <div className="flex gap-3">
        <Avatar className="h-8 w-8">
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{comment.user.firstName} {comment.user.lastName}</span>
            <span className="text-xs text-gray-500">
              {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
            </span>
            {comment.isEdited && <span className="text-xs text-gray-400">(edited)</span>}
          </div>

          {editing ? (
            <div className="mt-2 space-y-2">
              <Textarea value={editText} onChange={(e) => setEditText(e.target.value)} rows={2} />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleEdit}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{comment.content}</p>
          )}

          {!editing && (
            <div className="flex gap-2 mt-1">
              {depth === 0 && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setReplying(!replying)}>
                  <Reply className="h-3 w-3 mr-1" /> Reply
                </Button>
              )}
              {isOwn && (
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setEditing(true)}>
                  <Pencil className="h-3 w-3 mr-1" /> Edit
                </Button>
              )}
              {canDelete && (
                <Button variant="ghost" size="sm" className="h-7 text-xs text-red-600" onClick={() => onDelete(comment.id)}>
                  <Trash2 className="h-3 w-3 mr-1" /> Delete
                </Button>
              )}
            </div>
          )}

          {replying && (
            <div className="mt-2 space-y-2">
              <Textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="Write a reply..." rows={2} />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleReply}>Reply</Button>
                <Button size="sm" variant="ghost" onClick={() => setReplying(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {comment.replies?.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          onReply={onReply}
          onEdit={onEdit}
          onDelete={onDelete}
          depth={depth + 1}
        />
      ))}
    </div>
  )
}
