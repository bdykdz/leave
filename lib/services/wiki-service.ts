import { prisma } from '@/lib/prisma'
import { Role, WikiPageStatus, Prisma } from '@prisma/client'

// Helper: extract plain text from Tiptap JSON
const BLOCK_NODES = new Set([
  'paragraph', 'heading', 'bulletList', 'orderedList', 'listItem',
  'blockquote', 'codeBlock', 'horizontalRule', 'tableRow', 'tableCell',
  'tableHeader', 'taskList', 'taskItem',
])

function extractPlainText(node: any): string {
  if (!node) return ''
  if (typeof node === 'string') return node
  let text = ''
  if (node.text) text += node.text
  if (node.content && Array.isArray(node.content)) {
    for (const child of node.content) {
      text += extractPlainText(child)
      if (BLOCK_NODES.has(child.type)) {
        text += '\n'
      }
    }
  }
  return text
}

export class WikiService {
  // ── Pages ──────────────────────────────────────────────

  static async listPages(opts: {
    search?: string
    categoryId?: string
    tagId?: string
    status?: WikiPageStatus
    language?: string
    userRole?: Role
    page?: number
    limit?: number
    isPinned?: boolean
  }) {
    const { search, categoryId, tagId, status, language = 'en', userRole, page = 1, limit = 20, isPinned } = opts
    const skip = (page - 1) * limit

    const where: Prisma.WikiPageWhereInput = {}

    if (status) where.status = status
    if (categoryId) where.categoryId = categoryId
    if (isPinned !== undefined) where.isPinned = isPinned
    if (tagId) where.tags = { some: { tagId } }

    // Role visibility filter
    if (userRole) {
      where.OR = [
        { visibleToRoles: { isEmpty: true } },
        { visibleToRoles: { has: userRole } },
      ]
    }

    // Search in translations
    if (search) {
      where.translations = {
        some: {
          language,
          OR: [
            { title: { contains: search, mode: 'insensitive' } },
            { contentText: { contains: search, mode: 'insensitive' } },
          ],
        },
      }
    }

    const [pages, total] = await Promise.all([
      prisma.wikiPage.findMany({
        where,
        include: {
          translations: { where: { language } },
          category: true,
          author: { select: { id: true, firstName: true, lastName: true, profileImage: true } },
          tags: { include: { tag: true } },
          _count: { select: { comments: true } },
        },
        orderBy: [{ isPinned: 'desc' }, { sortOrder: 'asc' }, { updatedAt: 'desc' }],
        skip,
        take: limit,
      }),
      prisma.wikiPage.count({ where }),
    ])

    return { pages, total, page, limit, totalPages: Math.ceil(total / limit) }
  }

  static async getPageBySlug(slug: string) {
    return prisma.wikiPage.findUnique({
      where: { slug },
      include: {
        translations: true,
        category: true,
        author: { select: { id: true, firstName: true, lastName: true, profileImage: true } },
        tags: { include: { tag: true } },
        attachments: { include: { uploader: { select: { id: true, firstName: true, lastName: true } } } },
        _count: { select: { comments: true, revisions: true } },
      },
    })
  }

  static async createPage(data: {
    slug: string
    categoryId?: string
    authorId: string
    status: WikiPageStatus
    isPinned?: boolean
    sortOrder?: number
    visibleToRoles?: Role[]
    translations: { language: string; title: string; content: any; excerpt?: string }[]
    tagIds?: string[]
  }) {
    return prisma.wikiPage.create({
      data: {
        slug: data.slug,
        categoryId: data.categoryId || null,
        authorId: data.authorId,
        status: data.status,
        isPinned: data.isPinned || false,
        sortOrder: data.sortOrder || 0,
        visibleToRoles: data.visibleToRoles || [],
        publishedAt: data.status === 'PUBLISHED' ? new Date() : null,
        translations: {
          create: data.translations.map((t) => ({
            language: t.language,
            title: t.title,
            content: t.content,
            contentText: extractPlainText(t.content),
            excerpt: t.excerpt || extractPlainText(t.content).slice(0, 200),
          })),
        },
        tags: data.tagIds?.length
          ? { create: data.tagIds.map((tagId) => ({ tagId })) }
          : undefined,
        revisions: {
          create: data.translations.map((t) => ({
            language: t.language,
            version: 1,
            title: t.title,
            content: t.content,
            authorId: data.authorId,
            changeNote: 'Initial version',
          })),
        },
      },
      include: {
        translations: true,
        tags: { include: { tag: true } },
        category: true,
      },
    })
  }

  static async updatePage(
    slug: string,
    authorId: string,
    data: {
      categoryId?: string | null
      status?: WikiPageStatus
      isPinned?: boolean
      sortOrder?: number
      visibleToRoles?: Role[]
      translations?: { language: string; title: string; content: any; excerpt?: string }[]
      tagIds?: string[]
      changeNote?: string
    }
  ) {
    return prisma.$transaction(async (tx) => {
      const page = await tx.wikiPage.findUnique({
        where: { slug },
        include: { translations: true },
      })
      if (!page) throw new Error('Not found')

      // Build update
      const update: Prisma.WikiPageUpdateInput = { updatedAt: new Date() }
      if (data.categoryId !== undefined) update.category = data.categoryId ? { connect: { id: data.categoryId } } : { disconnect: true }
      if (data.status !== undefined) {
        update.status = data.status
        if (data.status === 'PUBLISHED' && !page.publishedAt) {
          update.publishedAt = new Date()
        }
      }
      if (data.isPinned !== undefined) update.isPinned = data.isPinned
      if (data.sortOrder !== undefined) update.sortOrder = data.sortOrder
      if (data.visibleToRoles !== undefined) update.visibleToRoles = data.visibleToRoles

      // Update translations and create revisions
      if (data.translations) {
        for (const t of data.translations) {
          const existing = page.translations.find((tr) => tr.language === t.language)
          const contentText = extractPlainText(t.content)
          const excerpt = t.excerpt || contentText.slice(0, 200)

          if (existing) {
            await tx.wikiPageTranslation.update({
              where: { id: existing.id },
              data: { title: t.title, content: t.content, contentText, excerpt },
            })
          } else {
            await tx.wikiPageTranslation.create({
              data: { pageId: page.id, language: t.language, title: t.title, content: t.content, contentText, excerpt },
            })
          }

          // Create revision (atomic within transaction to prevent version race)
          const latest = await tx.wikiRevision.findFirst({
            where: { pageId: page.id, language: t.language },
            orderBy: { version: 'desc' },
            select: { version: true },
          })
          const nextVersion = (latest?.version || 0) + 1

          await tx.wikiRevision.create({
            data: {
              pageId: page.id,
              language: t.language,
              version: nextVersion,
              title: t.title,
              content: t.content,
              authorId,
              changeNote: data.changeNote,
            },
          })
        }
      }

      // Update tags
      if (data.tagIds !== undefined) {
        await tx.wikiPageTag.deleteMany({ where: { pageId: page.id } })
        if (data.tagIds.length) {
          await tx.wikiPageTag.createMany({
            data: data.tagIds.map((tagId) => ({ pageId: page.id, tagId })),
          })
        }
      }

      return tx.wikiPage.update({
        where: { slug },
        data: update,
        include: {
          translations: true,
          tags: { include: { tag: true } },
          category: true,
          author: { select: { id: true, firstName: true, lastName: true } },
        },
      })
    })
  }

  static async deletePage(slug: string) {
    return prisma.wikiPage.update({
      where: { slug },
      data: { status: 'ARCHIVED' },
    })
  }

  static async incrementViewCount(slug: string) {
    return prisma.wikiPage.update({
      where: { slug },
      data: { viewCount: { increment: 1 } },
    })
  }

  // ── Revisions ──────────────────────────────────────────

  static async getNextVersion(pageId: string, language: string): Promise<number> {
    const latest = await prisma.wikiRevision.findFirst({
      where: { pageId, language },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    return (latest?.version || 0) + 1
  }

  static async listRevisions(pageId: string, language: string) {
    return prisma.wikiRevision.findMany({
      where: { pageId, language },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { version: 'desc' },
    })
  }

  static async getRevision(revisionId: string) {
    return prisma.wikiRevision.findUnique({
      where: { id: revisionId },
      include: { author: { select: { id: true, firstName: true, lastName: true } } },
    })
  }

  static async restoreRevision(revisionId: string, authorId: string) {
    return prisma.$transaction(async (tx) => {
      const revision = await tx.wikiRevision.findUnique({ where: { id: revisionId } })
      if (!revision) throw new Error('Not found')

      // Atomic version increment within transaction
      const latest = await tx.wikiRevision.findFirst({
        where: { pageId: revision.pageId, language: revision.language },
        orderBy: { version: 'desc' },
        select: { version: true },
      })
      const nextVersion = (latest?.version || 0) + 1

      // Create a new revision based on the old one
      await tx.wikiRevision.create({
        data: {
          pageId: revision.pageId,
          language: revision.language,
          version: nextVersion,
          title: revision.title,
          content: revision.content,
          authorId,
          changeNote: `Restored from version ${revision.version}`,
        },
      })

      // Update or create the translation (upsert handles deleted translations)
      const contentText = extractPlainText(revision.content)
      const excerpt = contentText.slice(0, 200)
      await tx.wikiPageTranslation.upsert({
        where: { pageId_language: { pageId: revision.pageId, language: revision.language } },
        update: { title: revision.title, content: revision.content, contentText, excerpt },
        create: { pageId: revision.pageId, language: revision.language, title: revision.title, content: revision.content, contentText, excerpt },
      })

      return tx.wikiPage.update({
        where: { id: revision.pageId },
        data: { updatedAt: new Date() },
        include: { translations: true },
      })
    })
  }

  // ── Comments ───────────────────────────────────────────

  static async listComments(pageId: string) {
    return prisma.wikiComment.findMany({
      where: { pageId, parentId: null },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, profileImage: true } },
        replies: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, profileImage: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  static async createComment(data: { pageId: string; userId: string; content: string; parentId?: string }) {
    return prisma.wikiComment.create({
      data: {
        pageId: data.pageId,
        userId: data.userId,
        content: data.content,
        parentId: data.parentId || null,
      },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, profileImage: true } },
      },
    })
  }

  static async updateComment(commentId: string, content: string) {
    return prisma.wikiComment.update({
      where: { id: commentId },
      data: { content, isEdited: true },
    })
  }

  static async deleteComment(commentId: string) {
    return prisma.wikiComment.delete({ where: { id: commentId } })
  }

  static async getComment(commentId: string) {
    return prisma.wikiComment.findUnique({ where: { id: commentId } })
  }

  // ── Categories ─────────────────────────────────────────

  static async listCategories() {
    return prisma.wikiCategory.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { pages: true } },
        children: {
          where: { isActive: true },
          include: { _count: { select: { pages: true } } },
        },
      },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    })
  }

  static async createCategory(data: {
    name: string
    nameEn: string
    nameRo: string
    slug: string
    description?: string
    icon?: string
    sortOrder?: number
    parentId?: string
  }) {
    return prisma.wikiCategory.create({ data })
  }

  static async updateCategory(id: string, data: Partial<{
    name: string
    nameEn: string
    nameRo: string
    slug: string
    description: string | null
    icon: string | null
    sortOrder: number
    isActive: boolean
    parentId: string | null
  }>) {
    return prisma.wikiCategory.update({ where: { id }, data })
  }

  static async deleteCategory(id: string) {
    const pageCount = await prisma.wikiPage.count({ where: { categoryId: id } })
    if (pageCount > 0) throw new Error('Validation: Cannot delete category with pages')
    return prisma.wikiCategory.delete({ where: { id } })
  }

  // ── Tags ───────────────────────────────────────────────

  static async listTags() {
    return prisma.wikiTag.findMany({
      include: { _count: { select: { pages: true } } },
      orderBy: { name: 'asc' },
    })
  }

  static async createTag(data: { name: string; nameEn: string; nameRo: string }) {
    return prisma.wikiTag.create({ data })
  }

  static async deleteTag(id: string) {
    return prisma.wikiTag.delete({ where: { id } })
  }

  // ── Attachments ────────────────────────────────────────

  static async listAttachments(pageId: string) {
    return prisma.wikiAttachment.findMany({
      where: { pageId },
      include: { uploader: { select: { id: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
    })
  }

  static async createAttachment(data: {
    pageId: string
    fileName: string
    fileUrl: string
    contentType: string
    fileSize: number
    uploadedBy: string
  }) {
    return prisma.wikiAttachment.create({ data })
  }

  static async getAttachment(id: string) {
    return prisma.wikiAttachment.findUnique({ where: { id } })
  }

  static async deleteAttachment(id: string) {
    return prisma.wikiAttachment.delete({ where: { id } })
  }

  // ── Search ─────────────────────────────────────────────

  static async searchPages(query: string, language: string = 'en', userRole?: Role) {
    const where: Prisma.WikiPageWhereInput = {
      status: 'PUBLISHED',
      translations: {
        some: {
          language,
          OR: [
            { title: { contains: query, mode: 'insensitive' } },
            { contentText: { contains: query, mode: 'insensitive' } },
          ],
        },
      },
    }

    if (userRole) {
      where.OR = [
        { visibleToRoles: { isEmpty: true } },
        { visibleToRoles: { has: userRole } },
      ]
    }

    return prisma.wikiPage.findMany({
      where,
      include: {
        translations: { where: { language } },
        category: true,
        author: { select: { id: true, firstName: true, lastName: true } },
        tags: { include: { tag: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    })
  }

  // ── Visibility ─────────────────────────────────────────

  static canUserViewPage(page: { visibleToRoles: Role[] }, role: Role): boolean {
    if (page.visibleToRoles.length === 0) return true
    return page.visibleToRoles.includes(role)
  }
}
