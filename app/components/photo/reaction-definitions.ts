export const REACTION_DEFINITIONS = [
  {
    id: 'like',
    iconName: 'fluent-emoji-flat:thumbs-up',
    label: '拍得好',
  },
  {
    id: 'love',
    iconName: 'fluent-emoji-flat:red-heart',
    label: '喜欢',
  },
  {
    id: 'amazing',
    iconName: 'fluent-emoji-flat:smiling-face-with-heart-eyes',
    label: '惊叹',
  },
  {
    id: 'funny',
    iconName: 'fluent-emoji-flat:face-with-tears-of-joy',
    label: '哈哈',
  },
  {
    id: 'wow',
    iconName: 'fluent-emoji-flat:face-with-open-mouth',
    label: '哇塞',
  },
  {
    id: 'sad',
    iconName: 'fluent-emoji-flat:crying-face',
    label: '感动',
  },
  {
    id: 'fire',
    iconName: 'fluent-emoji-flat:fire',
    label: '助火',
  },
  {
    id: 'sparkle',
    iconName: 'fluent-emoji-flat:sparkles',
    label: '闪耀',
  },
] as const

export type ReactionId = (typeof REACTION_DEFINITIONS)[number]['id']

export const REACTION_ICON_MAP: Record<ReactionId, string> = Object.fromEntries(
  REACTION_DEFINITIONS.map((reaction) => [reaction.id, reaction.iconName]),
) as Record<ReactionId, string>
