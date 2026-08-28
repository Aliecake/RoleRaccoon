export interface StarStory {
  id: string;
  user_id: string;
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface StarStoryFormData {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  tags: string;
}

export function emptyStarStoryFormData(): StarStoryFormData {
  return {
    title: '',
    situation: '',
    task: '',
    action: '',
    result: '',
    tags: '',
  };
}

export function starStoryToFormData(story: StarStory): StarStoryFormData {
  return {
    title: story.title,
    situation: story.situation,
    task: story.task,
    action: story.action,
    result: story.result,
    tags: story.tags.join(', '),
  };
}

export function starStoryFormDataToDb(data: StarStoryFormData) {
  return {
    title: data.title.trim(),
    situation: data.situation.trim(),
    task: data.task.trim(),
    action: data.action.trim(),
    result: data.result.trim(),
    tags: data.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean),
  };
}
